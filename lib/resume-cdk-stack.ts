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
  SUBJECT_TEXT,
  SES_EMAIL_SOURCE,
  REACH_OUT_SUBJECT
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
import * as ses from 'aws-cdk-lib/aws-ses';

export class ResumeCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    //S3 Bucket
    const staticWebsiteBucket = new S3Bucket(this);

    new S3BucketDeployment(this, staticWebsiteBucket);

    // Cloudfront Distribution with origin as S3 bucket
    new CloudFrontDistribution(this, staticWebsiteBucket);

    // Lambda function to send an email using SES
    const mailerLambdaFunction = new lambda.Function(this, 'MailerLambdaFunction', {
      runtime: lambda.Runtime.RUBY_2_7,
      handler: 'index.handler',
      memorySize: 1024,
      code: lambda.Code.fromAsset('lib/lambdas/email-handler'),
      timeout: cdk.Duration.seconds(3),
      environment: {
        'SES_EMAIL_SOURCE': SES_EMAIL_SOURCE,
        'REACH_OUT_SUBJECT': REACH_OUT_SUBJECT
      }
    });

    //SES email identity
    const identity = ses.Identity.email(SES_EMAIL_SOURCE)
    new ses.EmailIdentity(this, 'EmailIdentity', { identity: identity });

    // Create and add policy statement to allow lambda to send email using SES
    const sendEmailPolicy = new PolicyStatement({
      actions: [
        'ses:SendEmail',
        'ses:SendRawEmail',
        'ses:SendTemplatedEmail',
      ],
      resources: [
        `arn:aws:ses:${process.env.CDK_DEFAULT_ACCOUNT}:${process.env.CDK_DEFAULT_ACCOUNT}:identity/${identity.value}`
      ]
    })

    mailerLambdaFunction.addToRolePolicy(sendEmailPolicy)

    // CLoudWatch role for API Gateway
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

    // API Gateway REST API backed by "mailerLambdaFunction" function.
    const api = new apigw.LambdaRestApi(this, 'APIGateway', {
      handler: mailerLambdaFunction,
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

    // Define API Gateway resources
    const items = api.root.addResource('sendEmail');
    items.addMethod('POST'); // POST /sendEmail

    new CodeBuildProject(this);
  }
}
