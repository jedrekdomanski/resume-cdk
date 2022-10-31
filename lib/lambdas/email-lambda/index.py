import json
import boto3
import os

def handler(event, context):
  for record in event['Records']:
      send_request(record["body"])

def send_request(body):
  # Create an SNS client
  sns = boto3.client('sns')

  # Publish a simple message to the specified SNS topic
  response = sns.publish(
      TopicArn=os.environ['email_topic_arn'],
      Message=body,
  )

  # Print out the response
  print(response)
