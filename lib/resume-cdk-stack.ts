import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { S3Bucket } from './s3_bucket';
import { S3BucketDeployment } from './s3_bucket_deployment';
import { CloudFrontDistribution } from './cloud_front_distribution';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import {
  EMAIL_RESPONSE_BODY_KEY,
  EMAIL_RESPONSE_BODY_VALUE,
  EMAIL_SUBSCRIPTION,
  EMAIL_TOPIC_ARN,
  EMAIL_TOPIC_NAME
} from './consts';
import { Queue as SQSQueue } from 'aws-cdk-lib/aws-sqs';
import { Topic as SNSTopic } from 'aws-cdk-lib/aws-sns';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';

export class ResumeCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    //S3 Bucket
    const resumeBucket = new S3Bucket(this);
    new S3BucketDeployment(this, resumeBucket);

    // Cloudfront Distribution with origin as S3 bucket
    new CloudFrontDistribution(this, resumeBucket);

    // SQS Queue
    const queue = new SQSQueue(this, 'EmailSqsQueue', { fifo: false });

    // SNS Topic
    const topic = new SNSTopic(this, EMAIL_TOPIC_NAME, { displayName: 'Emails topic' });
    topic.addSubscription(new EmailSubscription(EMAIL_SUBSCRIPTION));

    // Lambda to long poll for new messages in SQS queue and publish the message to SNS topic
    const sqsLambda = new lambda.Function(this, 'SQSLambda', {
      runtime: lambda.Runtime.PYTHON_3_7,
      handler: 'index.handler',
      memorySize: 1024,
      timeout: cdk.Duration.seconds(3),
      code: lambda.Code.fromAsset('lib/lambdas/email-lambda'),
      environment: {
        EMAIL_TOPIC_ARN: topic.topicArn
      }
    });

    // Lambda function to send a message to SQS
    const mailerFunction = new lambda.Function(this, 'mailerFunction', {
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: 'index.handler',
      memorySize: 1024,
      timeout: cdk.Duration.seconds(3),
      code: lambda.Code.fromAsset('lib/lambdas/sqs-lambda'),
      environment: {
        EMAIL_RESPONSE_BODY_KEY: EMAIL_RESPONSE_BODY_VALUE
      }
    });

    // API Gateway REST API resource backed by "mailerFunction" function.
    const api = new apigw.LambdaRestApi(this, 'APIGateway', {
      handler: mailerFunction,
      proxy: false
    });

    const items = api.root.addResource('sendEmail');
    items.addMethod('POST'); // POST /sendEmail
  }
}
