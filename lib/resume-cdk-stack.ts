import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { S3Bucket } from './s3_bucket';
import { S3BucketDeployment } from './s3_bucket_deployment';
import { CloudFrontDistribution } from './cloud_front_distribution';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';

export class ResumeCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    //S3 Bucket
    const resumeBucket = new S3Bucket(this);
    new S3BucketDeployment(this, resumeBucket);

    // Cloudfront Distribution with origin as S3 bucket
    new CloudFrontDistribution(this, resumeBucket);

    // Lambda function to send an email using SES
    const resFn = new lambda.Function(this, 'ResumeLambdaFunction', {
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('resume-lambda')
    });

    // API Gateway REST API resource backed by "resFn" function.
    const api = new apigw.LambdaRestApi(this, 'APIGateway', {
      handler: resFn,
      proxy: false
    });

    const items = api.root.addResource('sendEmail');
    items.addMethod('POST'); // POST /sendEmail
  }
}
