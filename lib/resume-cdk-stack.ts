import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { S3Bucket } from './s3_bucket';
import { S3BucketDeployment } from './s3_bucket_deployment';
import { CloudFrontDistribution } from './cloud_front_distribution';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import {
  RESPONSE_BODY_KEY,
  RESPONSE_BODY,
  EMAIL_SUBSCRIPTION,
  EMAIL_TOPIC_ARN,
  EMAIL_TOPIC_NAME,
  SUBJECT_KEY,
  SUBJECT_TEXT,
  SQS_URL_KEY
} from './consts';
import { Queue as SQSQueue } from 'aws-cdk-lib/aws-sqs';
import { Topic as SNSTopic } from 'aws-cdk-lib/aws-sns';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';

export class ResumeCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    //S3 Bucket
    const staticWebsiteBucket = new S3Bucket(this);
    new S3BucketDeployment(this, staticWebsiteBucket);

    // Cloudfront Distribution with origin as S3 bucket
    new CloudFrontDistribution(this, staticWebsiteBucket);

    // SQS Queue
    const queue = new SQSQueue(this, 'EmailSqsQueue');

    // SNS Topic and subscription to the topic
    const topic = new SNSTopic(this, EMAIL_TOPIC_NAME, { displayName: 'Emails topic' });
    topic.addSubscription(new EmailSubscription(EMAIL_SUBSCRIPTION));

    // Lambda function to send a message to SQS
    const apiProxyLambda = new lambda.Function(this, 'apiProxyLambda', {
      runtime: lambda.Runtime.RUBY_2_7,
      handler: 'index.handler',
      memorySize: 1024,
      timeout: cdk.Duration.seconds(3),
      code: lambda.Code.fromAsset('lib/lambdas/api-proxy-handler'),
      environment: {
        SQS_URL_KEY: queue.queueUrl
      }
    });

    // API Gateway REST API backed by "apiProxyLambda" function.
    const api = new apigw.LambdaRestApi(this, 'APIGateway', {
      handler: apiProxyLambda,
      proxy: false
    });

    const items = api.root.addResource('sendEmail');
    items.addMethod('POST'); // POST /sendEmail

    // Lambda to publish the message to SNS topic
    const sqsMessagePublisherLambda = new lambda.Function(this, 'SQSPublisherLambda', {
      runtime: lambda.Runtime.RUBY_2_7,
      handler: 'index.handler',
      memorySize: 1024,
      timeout: cdk.Duration.seconds(3),
      code: lambda.Code.fromAsset('lib/lambdas/sqs-publisher-lambda'),
      environment: {
        EMAIL_TOPIC_ARN: topic.topicArn,
        SUBJECT_KEY: SUBJECT_TEXT
      }
    });
    const eventSource = new SqsEventSource(queue);
    sqsMessagePublisherLambda.addEventSource(eventSource)

    // Create a policy statement
    const sqsManageMessagesPolicy = new PolicyStatement({
      actions: [
        'sqs:ReceiveMessage',
        'sqs:DeleteMessage',
        'sqs:GetQueueAttributes'
      ],
      resources: [queue.queueArn]
    });

    sqsMessagePublisherLambda.role?.attachInlinePolicy(
      new Policy(this, 'manage-queue-messages', { statements: [sqsManageMessagesPolicy] })
    )
  }
}
