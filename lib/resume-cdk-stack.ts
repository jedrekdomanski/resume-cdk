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
  SUBJECT_TEXT
} from './consts';
import { Queue as SQSQueue } from 'aws-cdk-lib/aws-sqs';
import { Topic as SNSTopic } from 'aws-cdk-lib/aws-sns';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import {
  AnyPrincipal,
  ManagedPolicy,
  Policy,
  Role,
  PolicyDocument,
  PolicyStatement,
  ServicePrincipal
} from 'aws-cdk-lib/aws-iam';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { CodeBuildProject } from './code_build'

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
    const topic = new SNSTopic(this, EMAIL_TOPIC_NAME, { displayName: 'New Message From Your Website' });
    topic.addSubscription(new EmailSubscription(EMAIL_SUBSCRIPTION));

    // Lambda function to send a message to SQS
    const apiProxyLambda = new lambda.Function(this, 'apiProxyLambda', {
      runtime: lambda.Runtime.RUBY_2_7,
      handler: 'index.handler',
      memorySize: 1024,
      timeout: cdk.Duration.seconds(3),
      code: lambda.Code.fromAsset('lib/lambdas/api-proxy-handler'),
      environment: {
        'SQS_QUEUE_URL': queue.queueUrl
      }
    });

    // Create and add policy statement to allow lambda to send message to SQS queue
    const sendMessagePolicy = new PolicyStatement({
      actions: [ 'sqs:SendMessage' ],
      resources: [queue.queueArn]
    });

    apiProxyLambda.role?.attachInlinePolicy(
      new Policy(this, 'send-message', { statements: [sendMessagePolicy] })
    )

    const cloudWatchRole = new Role(this, 'CloudWatchRole', {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
      description: 'Grant write access to CloudWatch',
    });

    const policy = ManagedPolicy.fromManagedPolicyArn(
      this,
      'CloudWatchManagedPolicy',
      'arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs'
    );

    cloudWatchRole.addManagedPolicy(policy);

    const cfnAccount = new apigw.CfnAccount(this, 'ApiGatewayAccount', {
      cloudWatchRoleArn: cloudWatchRole.roleArn,
    });

    // API Gateway REST API backed by "apiProxyLambda" function.
    const api = new apigw.LambdaRestApi(this, 'APIGateway', {
      handler: apiProxyLambda,
      proxy: false,
      cloudWatchRole: true
    });

    // Enable API log group
    const stage = api.deploymentStage!.node.defaultChild as apigw.CfnStage;
    const logGroup = new LogGroup(api, 'AccessLogs', {
      retention: 30, // Keep logs for 30 days
    });

    stage.accessLogSetting = {
      destinationArn: logGroup.logGroupArn,
      format: JSON.stringify({
        requestId: '$context.requestId',
        userAgent: '$context.identity.userAgent',
        sourceIp: '$context.identity.sourceIp',
        requestTime: '$context.requestTime',
        httpMethod: '$context.httpMethod',
        path: '$context.path',
        status: '$context.status',
        responseLength: '$context.responseLength',
      }),
    };
    logGroup.grantWrite(new ServicePrincipal('apigateway.amazonaws.com'));

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
        'EMAIL_TOPIC_ARN': topic.topicArn,
        'JOB_OFFER_SUBJECT': SUBJECT_TEXT
      }
    });
    const eventSource = new SqsEventSource(queue);
    sqsMessagePublisherLambda.addEventSource(eventSource)

    // Create a policy statement to allow lambda to read/delete/GetQueueAttributes from SQS queue
    const sqsManageMessagesPolicy = new PolicyStatement({
      actions: [
        'sqs:ReceiveMessage',
        'sqs:DeleteMessage',
        'sqs:GetQueueAttributes'
      ],
      resources: [queue.queueArn]
    });

    // Create a policy statement to allow lambda to publish messages to SNS topic
    const publishMessagesToTopicPolicy = new PolicyStatement({
      actions: [
        'sns:Publish'
      ],
      resources: [topic.topicArn]
    });

    sqsMessagePublisherLambda.role?.attachInlinePolicy(
      new Policy(this, 'manage-queue-messages',{
        statements: [
          sqsManageMessagesPolicy,
          publishMessagesToTopicPolicy
        ]
      })
    )

    new CodeBuildProject(this);
  }
}
