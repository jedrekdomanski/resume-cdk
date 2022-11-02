require 'json'
require 'aws-sdk-sns'
require 'logger'

def handler(event:, context:)
  parsed_event = JSON.parse(event)
  parsed_event['Records'].each do |record|
    publish_message(record['body'])
  end
end

def publish_message(body)
  message_params = {
    topic_arn: ENV.fetch('EMAIL_TOPIC_ARN'),
    subject: ENV.fetch('JOB_OFFER_SUBJECT'),
    message: build_message(body)
  }
  logger = Logger.new($stdout)
  logger.info('## Publishing New Message ##')
  logger.info(body)

  client = Aws::SNS::Client.new
  response = client.publish(message_params)

  logger.info('## Message Published ##')
  logger.info(response)
end

def build_message(body)
  '<html>' \
    '<head><title>HTML from API Gateway/Lambda</title></head>' \
    '<body>' \
      "<h3>FROM: #{body['name']}</h3></br>" \
      "<h3>EMAIL: #{body['email']}</h3></br>" \
      "<h3>EMAIL: #{body['message']}</h3></br>" \
    '</body>' \
  '</html>'
end
