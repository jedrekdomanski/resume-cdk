# frozen_string_literal: true

require 'json'
require 'aws-sdk-sqs'
require_relative './requester_message'

def handler(event:, context:)
  parsed_event = JSON.parse(event)
  name    = parsed_event['body']['name']
  email   = parsed_event['body']['email']
  message = parsed_event['body']['message']
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
    message: JSON.generate({ name: name, email: email, message: message })
  }
  client.send_message(message)
end
