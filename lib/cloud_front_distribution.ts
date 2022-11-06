import { Construct } from 'constructs';
import { Tags } from 'aws-cdk-lib';
import { CLOUD_FRONT_DISTRIBUTION_NAME, DEFAULT_ROOT_OBJECT } from './consts';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { S3Origin} from 'aws-cdk-lib/aws-cloudfront-origins';
import { Effect, PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';

export class CloudFrontDistribution extends cloudfront.Distribution {
  constructor(scope: Construct, bucket: Bucket) {
    super(scope, CLOUD_FRONT_DISTRIBUTION_NAME, {
      defaultBehavior: {
        origin: new S3Origin(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true
      },
      defaultRootObject: DEFAULT_ROOT_OBJECT,
      comment: 'Cloud Front distribution backed with S3 backet'
    });
    Tags.of(this).add('DistributionName', 'S3bucket Cloud Front distribution');
  };
};
