import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Bucket, BlockPublicAccess } from 'aws-cdk-lib/aws-s3';
import { S3_BUCKET_NAME } from './consts';
import { S3BucketDeployment } from './s3_bucket_deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin} from 'aws-cdk-lib/aws-cloudfront-origins';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import {
  SES_EMAIL_SOURCE,
  REACH_OUT_SUBJECT,
  DOMAIN_NAME,
  WWW_DOMAIN_NAME,
  API_DOMAIN_NAME,
  CLOUD_FRONT_DISTRIBUTION_NAME,
  DEFAULT_ROOT_OBJECT,
  HOSTED_ZONE_ID
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
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as targets from 'aws-cdk-lib/aws-route53-targets';

export class ResumeCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //S3 Bucket
    const staticWebsiteBucket = new Bucket(this, S3_BUCKET_NAME, {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL
    });

    //S3 Bucket Deployment
    new S3BucketDeployment(this, staticWebsiteBucket);

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'MyZone', {
       hostedZoneId: HOSTED_ZONE_ID,
       zoneName: DOMAIN_NAME
     });

    // Create HTTPS certificates for frontend and API
    const certificate = new acm.DnsValidatedCertificate(this, 'ResumeCertificate', {
      domainName: DOMAIN_NAME,
      hostedZone: hostedZone,
      region: 'us-east-1'
    });

    const apiCertificate = new acm.Certificate(this, 'ApiResumeCertificate', {
      domainName: API_DOMAIN_NAME,
      certificateName: API_DOMAIN_NAME,
      validation: acm.CertificateValidation.fromDns(hostedZone)
    });

    // Cloudfront Distribution with origin as S3 bucket
    const distribution = new cloudfront.Distribution(this, CLOUD_FRONT_DISTRIBUTION_NAME, {
      defaultBehavior: {
        origin: new S3Origin(staticWebsiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true
      },
      defaultRootObject: DEFAULT_ROOT_OBJECT,
      certificate: certificate,
      domainNames: [DOMAIN_NAME],
      comment: 'Cloud Front distribution backed with S3 backet'
    });

    new route53.ARecord(this, 'jedrzejdomanski.com', {
      recordName: DOMAIN_NAME,
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution))
    });

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
    const emailIdentity = new ses.EmailIdentity(this, 'EmailIdentity', { identity: identity });
    const emailIdentityArn = cdk.Stack.of(this).formatArn({
      service: 'ses',
      resource: 'identity',
      resourceName: emailIdentity.emailIdentityName,
      arnFormat: cdk.ArnFormat.SLASH_RESOURCE_NAME,
    });
    // Create and add policy statement to allow lambda to send emails using SES
    const sendEmailPolicy = new PolicyStatement({
      actions: [
        'ses:SendEmail',
        'ses:SendRawEmail',
        'ses:SendTemplatedEmail',
      ],
      resources: [ emailIdentityArn ]
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
      cloudWatchRole: true,
      domainName: {
        domainName: API_DOMAIN_NAME,
        certificate: apiCertificate,
        basePath: 'api',
        securityPolicy: apigw.SecurityPolicy.TLS_1_2
      },
      endpointConfiguration: {
        types: [apigw.EndpointType.REGIONAL]
      },
      disableExecuteApiEndpoint: true,
      defaultCorsPreflightOptions: {
        allowOrigins: [ `https://${DOMAIN_NAME}` ],
        allowMethods: [ 'POST' ]
      }
    });

    // DNS A records
    new route53.ARecord(this, 'api.jedrzejdomanski.com', {
      recordName: API_DOMAIN_NAME,
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new targets.ApiGateway(api))
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
