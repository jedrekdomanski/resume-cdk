import { Construct } from 'constructs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source }from 'aws-cdk-lib/aws-s3-deployment';
import { S3_BUCKET_DEPLOYMENT_NAME } from './consts';

export class S3BucketDeployment extends BucketDeployment {
  constructor(scope: Construct, bucket: Bucket) {
    super(scope, S3_BUCKET_DEPLOYMENT_NAME, {
      sources: [Source.asset('lib/static-website')],
      destinationBucket: bucket
    });
  }
};
