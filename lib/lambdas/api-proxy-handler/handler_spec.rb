# frozen_string_literal: true

require 'rspec'
require_relative './index'

RSpec.describe 'handler', :unit do
  it 'returns 200 status code and proper message when event is valid' do
    valid_event = {
      'resource' => '/sendEmail',
      'queryStringParameters' => { 'name' => 'Test', 'message' => 'Test', 'email' => 'Test' },
      'body' => { 'name' => 'Test', 'email' => 'Email', 'message' => 'message' }
    }
    allow(ENV).to receive(:fetch).with('SQS_QUEUE_URL').and_return('http://url')
    expect(Aws::SQS::Client).to receive_message_chain(:new, :send_message)

    result = handler(event: valid_event, context: nil)

    expect(result[:body]).to eq('Thank you for reaching out! I\'ll contact you as soon as I can')
    expect(result[:status_code]).to eq(200)
  end

  it 'returns 400 status code and proper message when event is invalid' do
    invalid_event = {
      'resource' => '/sendEmail',
      'queryStringParameters' => { 'name' => 'Test', 'message' => 'Test', 'email' => 'Test' },
      'body' => { 'message' => 'message' }
    }
    result = handler(event: invalid_event, context: nil)

    expect(result[:body][:error]).to eq('Name can\'t be blank and Email can\'t be blank')
    expect(result[:status_code]).to eq(400)
  end
end
