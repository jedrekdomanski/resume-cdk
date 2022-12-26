# frozen_string_literal: true

require 'aws-sdk-ses'
require 'json'

def handler(event:, context:)
  logger = Logger.new($stdout)
  logger.info('## Received New Message from API##')
  logger.info(event)

  request_body = JSON.parse(event['body'])
  name    = request_body['name']
  email   = request_body['email']
  message = request_body['message']

  validate_params(name, email, message)

  send_message_to_ses(name, email, message)
  success
rescue StandardError => e
  error(e)
end

private

def validate_params(name, email, message)
  validate_presence_of(name)
  validate_presence_of(email)
  validate_presence_of(message)
end

def validate_presence_of(attr)
  return unless attr.empty?

  raise StandardError, "Name, email and message can't be blank"
end

def send_message_to_ses(name, email, message)
  client = Aws::SES::Client.new
  message = build_message(name, email, message)
  client.send_email(message)
end

def success
  {
    body: JSON.generate(message: 'Thank you for reaching out! I\'ll contact you as soon as I can'),
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Headers': 'Origin,Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,OPTIONS,POST',
      'Access-Control-Allow-Origin': '*'
    },
    isBase64Encoded: false
  }
end

def error(error)
  {
    body: JSON.generate({ error: error.message }),
    statusCode: 400,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Headers': 'Origin,Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,OPTIONS,POST',
      'Access-Control-Allow-Origin': '*'
    },
    isBase64Encoded: false
  }
end

def build_message(name, email, message)
  {
    source: ENV.fetch('SES_EMAIL_SOURCE'),
    destination: {
      to_addresses: [ENV.fetch('SES_EMAIL_SOURCE')]
    },
    message: {
      subject: {
        charset: 'UTF-8',
        data: "#{name} #{ENV.fetch('REACH_OUT_SUBJECT')}"
      },
      body: {
        html: {
          charset: 'UTF-8',
          data: "Message from #{name}: #{message}, sender email: #{email} " \
            "<a class=\"ulink\" href=\"http://docs.aws.amazon.com/ses/latest/DeveloperGuide\" target=\"_blank\">Amazon SES Developer Guide</a>."
        }
      }
    }
  }
end
