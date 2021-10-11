import { expect as expectCDK, matchTemplate, MatchStyle, SynthUtils } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
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
    expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});
