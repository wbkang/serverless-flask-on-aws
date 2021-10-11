# Serverless Flask Starter Kit

This is a starter kit for hosting Flask on AWS using Serverless components. Find the more detailed explanations at [my blog](https://wbk.one/).

## Prerequisite

### AWS CLI

Install [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html).

### AWS Account Setup

You need an AWS account.

You need to create an IAM user with Administrator access. Follow [this guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/getting-started_create-admin-group.html) to setup one.

Create an access key, and configure your AWS CLI to use it by default:

```aws configure```

Alternatively, you can create a named profile and export AWS_PROFILE variable to point to that profile.

### Python 3.9+

You will need a recent Python version greater than 3.9. If you don't have it, you can use [pyenv](https://github.com/pyenv/pyenv) to install it.

### pipenv

We will use pipenv to manage Python package dependencies. You can install it like this:

`python3 -m pip install --user pipenv`

Make sure to add the user package installation location to your PATH. Example:

`export PATH="$(python3 -c 'import site; print(site.USER_BASE)')/bin:${PATH}"`

### NodeJS

We need to [install NodeJS](https://nodejs.org/en/download/) so we can use [CDK](https://docs.aws.amazon.com/cdk/latest/guide/home.html).

### CDK

Install the [CDK toolkit](https://docs.aws.amazon.com/cdk/latest/guide/cli.html).

### Docker

Install [docker](https://docs.docker.com/get-docker/). We need this for SAM. If you don't plan to run SAM you don't need it.

### SAM CLI

Install [SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html). If you don't plan to run SAM you don't need it.

### Other tools

You will need need `jq`

## Local Development

### IDE Recommendation

If you open the folder with [Visual Studio Code](https://code.visualstudio.com/), everything should work out of the box.

### Entering the pipenv shell

Run `pipenv sync -d` to install the dependencies.

Run `pipenv shell` to enter the environment for the Python code.


### Install npm dependencies for CDK

Run `npm install` to install all CDK dependencies. 

### CDK Bootstrap

CDK Bootstrap needs to be done once per region: `cdk bootstrap`

### Dev Stack Deployment

The sample CDK app takes a context variable named `stage` which can be `dev`, `staging`, or `prod`. We need to deploy the `dev` stage stack once and create an IAM user to simulate the same permission as the lambda.

The following snippet will auto-create a profile named `serverless-flask-dev`, which we can use to test the application using the same permissions as the lambda.

```
make deploy-dev
profile=serverless-flask-dev
creds=$(aws iam create-access-key --user-name $(jq -r '."serverless-flask-dev".devIamUser' cdk.out/dev-stage-output.json) --output json) 
aws configure set aws_access_key_id  $(echo "$creds" | jq -r '.AccessKey.AccessKeyId') --profile $profile
aws configure set aws_secret_access_key   $(echo "$creds" | jq -r '.AccessKey.SecretAccessKey') --profile $profile
aws configure set output json --profile $profile
```

### Deploying the dev stage Stack

Deploy the dev stack once.

```
make deploy-dev
```

If you want to rebuild your Python/NPM dependencies, just do `make clean`.

### Running the unit test

Under pipenv shell:
```
make test
```
See `conftest.py` for the fixtures. See [pytest](https://pytest.org/) for more documentation.

### Running the local Flask server

There is a convenient launcher to start the local Flask server with the same environment variable as the Lambda:

```
make run-flask
```

Your server will be running at https://localhost:5000/

Deploy to the sam-local stack which emulates a locally-running lambda more faithfully:

```
make sam-local
```

### Run all tests

`make`

For CDK, there is only a very basic snapshot test. See [snapshot tests](https://docs.aws.amazon.com/cdk/latest/guide/testing.html#testing_snapshot).


## Deployment

You can deploy either using the `staging` stage or `prod` stage. 

`staging` stage merely exists so you can have an environment that mirrors prod exactly.

### Deploy to Staging

```
make deploy-staging
```

Use the output value `ServerlessFlask.CDNDomain` to access the website.

### Deploy to Prod

```
make deploy-prod
```

Use the output value `ServerlessFlask.CDNDomain` to access the website.

### Upgrade Python Dependencies

`pipenv update --outdated`

## CDK-inherited README.md

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
