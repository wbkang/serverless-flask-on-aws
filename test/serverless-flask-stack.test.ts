import { Template } from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib';
import * as ServerlessFlask from '../lib/serverless-flask-stack';

// super basic snapshot testing
// See https://docs.aws.amazon.com/cdk/latest/guide/testing.html
test('SnapshotTest', () => {
    const app = new cdk.App({context: {
      "stage": "prod"
    }});
    // WHEN
    const stack = new ServerlessFlask.ServerlessFlaskStack(app, 'MyTestStack');
    // THEN
    const template = Template.fromStack(stack);
    expect(template.toJSON()).toMatchSnapshot();
});
