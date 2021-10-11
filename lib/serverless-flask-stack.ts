import * as cdk from '@aws-cdk/core';
import { CfnOutput, Duration, RemovalPolicy } from '@aws-cdk/core';
import * as agw from '@aws-cdk/aws-apigateway';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as eventTargets from "@aws-cdk/aws-events-targets";
import * as s3 from '@aws-cdk/aws-s3';
import * as events from "@aws-cdk/aws-events";
import { RuleTargetInput } from '@aws-cdk/aws-events';
import * as cloudfront from '@aws-cdk/aws-cloudfront';
import * as origins from '@aws-cdk/aws-cloudfront-origins';
import * as logs from '@aws-cdk/aws-logs';
import { BlockPublicAccess, BucketEncryption } from '@aws-cdk/aws-s3';

const LAMBDA_CONFIG_ENV : {[key:string]: {[key:string]:any}} = {
  "dev": {
    "SESSION_COOKIE_SECURE": false,
    "DEBUG": true,
    "TEMPLATES_AUTO_RELOAD": true,
    "SEND_FILE_MAX_AGE_DEFAULT": 300,
    "PERMANENT_SESSION_LIFETIME": 86400, // 1 day
    "SERVER_NAME": "localhost:5000",
    "ROOT_LOG_LEVEL": "DEBUG"
  },
  'staging': {
    "SESSION_COOKIE_SECURE": true,
    "DEBUG": false,
    "TEMPLATES_AUTO_RELOAD": false,
    "SEND_FILE_MAX_AGE_DEFAULT": 300,
    "PERMANENT_SESSION_LIFETIME": 86400, // 1 day,
    "ROOT_LOG_LEVEL": "DEBUG"
  },
  "prod": {
    "SESSION_COOKIE_SECURE": true,
    "DEBUG": false,
    "TEMPLATES_AUTO_RELOAD": false,
    "SEND_FILE_MAX_AGE_DEFAULT": 300,
    "PERMANENT_SESSION_LIFETIME": 86400, // 1 day
    "ROOT_LOG_LEVEL": "INFO"
  }
};

const MAX_RPS = 100;
const MAX_RPS_BUCKET_SIZE = 1000;

export class ServerlessFlaskStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const stageName = this.node.tryGetContext("stage") as string;

    let appStore = new s3.Bucket(this, "S3Storage", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy:RemovalPolicy.RETAIN,
      encryption: BucketEncryption.S3_MANAGED,
      bucketName: `${this.account}-serverlessflask-s3storage-${stageName}`
    });


    // this is the lambda role
    let lambdaRole = new iam.Role(this, "LambdaRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      inlinePolicies: {
        "lambda-executor": new iam.PolicyDocument({
          assignSids: true,
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["ec2:DescribeTags",
                "cloudwatch:GetMetricStatistics",
                "cloudwatch:ListMetrics",
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
                "logs:DescribeLogStreams"],
              resources: ["*"]
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["lambda:InvokeFunction"],
              resources: ["*"]
            })
          ]
        })
      }
    });
    

    let lambdaEnv = LAMBDA_CONFIG_ENV[stageName];
    lambdaEnv["S3_BUCKET"] = appStore.bucketName;

    let webappLambda = new lambda.Function(this, "ServerlessFlaskLambda", {
      functionName: `serverless-flask-lambda-${stageName}`,
      code: lambda.Code.fromAsset(__dirname + "/../build-python/",),
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: "serverless_flask.lambda.lambda_handler",
      role: lambdaRole,
      timeout: Duration.seconds(30),
      memorySize: 256,
      environment: {"JSON_CONFIG_OVERRIDE": JSON.stringify(lambdaEnv)},
      // default is infinite, and you probably don't want it
      logRetention: logs.RetentionDays.SIX_MONTHS,
    });

    
    let restApi = new agw.LambdaRestApi(this, "FlaskLambdaRestApi", {
      restApiName: `serverless-flask-api-${stageName}`,
      handler: webappLambda,
      binaryMediaTypes: ["*/*"],
      deployOptions: {
        throttlingBurstLimit: MAX_RPS_BUCKET_SIZE,
        throttlingRateLimit: MAX_RPS
      }
    });
    const restApiUrl = `${restApi.restApiId}.execute-api.${this.region}.amazonaws.com`;

    if (this.node.tryGetContext("stage") !== "dev") {
      let cdn = new cloudfront.Distribution(this, "CDN", {
        defaultBehavior: {
          functionAssociations: [{
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            function: new cloudfront.Function(this, "RewriteCdnHost", {
              functionName: `${this.account}${this.stackName}RewriteCdnHostFunction${stageName}`,
              // documentation: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-event-structure.html#functions-event-structure-example
              code: cloudfront.FunctionCode.fromInline(`
              function handler(event) {
                var req = event.request;
                if (req.headers['host']) {
                  req.headers['x-forwarded-host'] = {
                    value: req.headers['host'].value
                  };
                }
                return req;
              }
              `)
            })
          }],
          origin: new origins.HttpOrigin(restApiUrl, {
            originPath: "/prod",
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            connectionAttempts: 3,
            connectionTimeout: Duration.seconds(10),
            httpsPort: 443,
          }),
          smoothStreaming: false,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          compress: true,
          cachePolicy: new cloudfront.CachePolicy(this, 'DefaultCachePolicy', {
              // need to be overriden because the names are not automatically randomized across stages
              cachePolicyName: `CachePolicy-${stageName}`,
              headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList("x-forwarded-host"),
              // allow Flask session variable
              cookieBehavior: cloudfront.CacheCookieBehavior.allowList("session"),
              queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
              maxTtl: Duration.hours(1),
              defaultTtl: Duration.minutes(5),
              enableAcceptEncodingGzip: true,
              enableAcceptEncodingBrotli: true
          }),
        },
        priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
        enabled: true,
        httpVersion: cloudfront.HttpVersion.HTTP2,
      });
      new CfnOutput(this, "CDNDomain", {
        value: "https://" + cdn.distributionDomainName
      });
    }
    
    const grantLambdaResourcePermissions = (entity: iam.IGrantable) => {
      appStore.grantReadWrite(entity);
    };
    grantLambdaResourcePermissions(lambdaRole);
    
    // create dev user - not applicable for anything other than dev stage
    if (this.node.tryGetContext("stage") === "dev") {
      let localDevUser = new iam.User(this, "serverless-flask-local-dev");
      new CfnOutput(this, "devIamUser", {
        value: localDevUser.userName
      });
      grantLambdaResourcePermissions(localDevUser);

      // export the lambda variables for later use
      new CfnOutput(this, "LambdaEnv", {
        value: JSON.stringify(lambdaEnv)
      });
    }
  }
}
