import { Construct } from 'constructs';
import { CLOUD_FRONT_DISTRIBUTION_NAME } from './consts';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { S3Origin} from 'aws-cdk-lib/aws-cloudfront-origins';

export class CloudFrontDistribution extends cloudfront.Distribution {
  constructor(scope: Construct, bucket: Bucket) {
    super(scope, CLOUD_FRONT_DISTRIBUTION_NAME, {
      defaultBehavior: {
        origin: new S3Origin(bucket),
        originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
      },
    });
  };
};
