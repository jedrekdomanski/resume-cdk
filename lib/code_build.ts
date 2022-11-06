import { Construct } from 'constructs';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import { GITHUB_OWNER, GITHUB_REPO_NAME } from './consts'
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';

export class CodeBuildProject extends codebuild.Project {
  constructor(scope: Construct) {
    super(scope, 'ResumeCodeBuild', {
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          build: {
            commands: [
              'aws s3 sync . s3://resumecdkstack-website333b7473-sd8uxubg3bgw --delete'
            ]
          }
        }
      }),
      source: codebuild.Source.gitHub({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO_NAME,
        webhook: true,
        webhookFilters: [
          codebuild.FilterGroup
            .inEventOf(codebuild.EventAction.PUSH)
            .andBranchIs('master')
        ]
      })
    });

    const syncS3BucketPolicy = ManagedPolicy.fromManagedPolicyArn(
      this,
      'SyncS3BucketPolicy',
      'arn:aws:iam::aws:policy/AmazonS3FullAccess'
    );

    this.role?.addManagedPolicy(syncS3BucketPolicy);
  };
}
