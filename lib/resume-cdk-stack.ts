import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { S3Bucket } from './s3_bucket';
import { S3BucketDeployment } from './s3_bucket_deployment';
import { CloudFrontDistribution } from './cloud_front_distribution';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import { EMAIL_RESPONSE_BODY_KEY, EMAIL_RESPONSE_BODY_VALUE } from './consts';

export class ResumeCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    //S3 Bucket
    const resumeBucket = new S3Bucket(this);
    new S3BucketDeployment(this, resumeBucket);

    // Cloudfront Distribution with origin as S3 bucket
    new CloudFrontDistribution(this, resumeBucket);

    // Lambda function to send an email using SES
    const mailerFunction = new lambda.Function(this, 'mailerFunction', {
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: 'index.handler',
      memorySize: 1024,
      timeout: cdk.Duration.seconds(3),
      code: lambda.Code.fromAsset('resume-lambda'),
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
