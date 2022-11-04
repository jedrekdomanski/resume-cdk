import { Construct } from 'constructs';
import { Bucket, BlockPublicAccess } from 'aws-cdk-lib/aws-s3';
import { S3_BUCKET_NAME } from './consts';

export class S3Bucket extends Bucket {
  constructor(scope: Construct) {
    super(scope, S3_BUCKET_NAME, {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL
    });
  }
};
