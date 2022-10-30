#
# Lambda function to to send an email using SES
#

import logging
import boto3
import os
import json

def handler(event, context):
  print("Lambda processing event: ", event)
