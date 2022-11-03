# frozen_string_literal: true

require 'aws-sdk-sqs'
require_relative './requester_message'
require 'json'
require 'logger'

def handler(event:, context:)
  logger = Logger.new($stdout)
  logger.info('## Received New Message from API##')
  logger.info(event)

  name    = event['body']['name']
  email   = event['body']['email']
  message = event['body']['message']
  message = RequesterMessage.new(name: name, email: email, message: message)

  return error_response(message) if message.invalid?

  send_message_to_sqs(name, email, message)
  {
    body: 'Thank you for reaching out! I\'ll contact you as soon as I can',
    status_code: 200
  }
rescue StandardError => e
  {
    body: { error: e.message },
    status_code: 400
  }
end

private

def error_response(message)
  {
    body: { error: message.errors.full_messages.to_sentence },
    status_code: 400
  }
end

def send_message_to_sqs(name, email, message)
  client = Aws::SQS::Client.new
  message = {
    queue_url: ENV.fetch('SQS_QUEUE_URL'),
    message_body: JSON.generate({ name: name, email: email, message: message })
  }
  client.send_message(message)
end

# Sample event payload (Hash)

# {"resource"=>"/sendEmail",
#  "path"=>"/sendEmail",
#  "httpMethod"=>"POST",
#  "headers"=>nil,
#  "multiValueHeaders"=>nil,
#  "queryStringParameters"=>{"name"=>"Test", "message"=>"Test", "email"=>"Test"},
#  "multiValueQueryStringParameters"=>{"name"=>["Test"], "message"=>["Test"], "email"=>["Test"]},
#  "pathParameters"=>nil,
#  "stageVariables"=>nil,
#  "requestContext"=>
#   {"resourceId"=>"lbgf16",
#    "resourcePath"=>"/sendEmail",
#    "httpMethod"=>"POST",
#    "extendedRequestId"=>"a_xxEFaLFiAFRcw=",
#    "requestTime"=>"02/Nov/2022:23:27:15 +0000",
#    "path"=>"/sendEmail",
#    "accountId"=>"317905390022",
#    "protocol"=>"HTTP/1.1",
#    "stage"=>"test-invoke-stage",
#    "domainPrefix"=>"testPrefix",
#    "requestTimeEpoch"=>1667431635462,
#    "requestId"=>"240ec3e1-5110-4f40-97d7-bd4a43791e7f",
#    "identity"=>
#     {"cognitoIdentityPoolId"=>nil,
#      "cognitoIdentityId"=>nil,
#      "apiKey"=>"test-invoke-api-key",
#      "principalOrgId"=>nil,
#      "cognitoAuthenticationType"=>nil,
#      "userArn"=>"arn:aws:iam::317905390022:user/jedrek",
#      "apiKeyId"=>"test-invoke-api-key-id",
#      "userAgent"=>"aws-internal/3 aws-sdk-java/1.12.302 Linux/5.4.209-129.367.amzn2int.x86_64 OpenJDK_64-Bit_Server_VM/25.352-b08 java/1.8.0_352 vendor/Oracle_Corporation cfg/retry-mode/standard",
#      "accountId"=>"317905390022",
#      "caller"=>"AIDAUUBFDJHDNOSYBIOWY",
#      "sourceIp"=>"test-invoke-source-ip",
#      "accessKey"=>"ASIAUUBFDJHDLOP6FXFW",
#      "cognitoAuthenticationProvider"=>nil,
#      "user"=>"AIDAUUBFDJHDNOSYBIOWY"},
#    "domainName"=>"testPrefix.testDomainName",
#    "apiId"=>"p7j45aoqjd"},
#  "body"=>"{\"name\": \"Test\", \"email\": \"Email\", \"message\": \"message\"}",
#  "isBase64Encoded"=>false}
