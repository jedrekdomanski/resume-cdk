# frozen_string_literal: true

require 'rspec'
require_relative './index'

RSpec.describe 'handler', :unit do
  it 'returns 200 status code and proper message when event is valid' do
    valid_event = {
      'resource' => '/sendMessage',
      'queryStringParameters' => '{ "name": "Test", "message": "Test", "email": "Test" }',
      'body' => '{ "name": "Test", "email": "Email", "message": "message" }'
    }
    allow(ENV).to receive(:fetch).with('SES_EMAIL_SOURCE').and_return('email@example.com')
    allow(ENV).to receive(:fetch).with('REACH_OUT_SUBJECT').and_return('Some text')
    expect(Aws::SES::Client).to receive_message_chain(:new, :send_email)

    result = handler(event: valid_event, context: nil)
    response = JSON.parse(result[:body])

    expect(response['message']).to eq('Thank you for reaching out! I\'ll contact you as soon as I can.')
    expect(result[:statusCode]).to eq(200)
  end

  it 'returns 400 status code and proper message when event is invalid' do
    invalid_event = {
      'resource' => '/sendEmail',
      'queryStringParameters' => '{"name":"Test","message":"Test","email":"Test" }',
      'body' => '{ "name": "","email":"Email","message":"message" }'
    }
    result = handler(event: invalid_event, context: nil)
    response = JSON.parse(result[:body])

    expect(response['error']).to eq('Name, email and message can\'t be blank')
    expect(result[:statusCode]).to eq(400)
  end
end
