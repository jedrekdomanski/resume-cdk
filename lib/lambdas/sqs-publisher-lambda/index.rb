require 'aws-sdk-sns'
require 'logger'

def handler(event:, context:)
  log_info(event)
  event['Records'].each do |record|
    publish_message(record['body'])
  end
end

def publish_message(body)
  message_params = {
    topic_arn: ENV.fetch('EMAIL_TOPIC_ARN'),
    subject: ENV.fetch('JOB_OFFER_SUBJECT'),
    message: build_message(body)
  }
  log_info('## Publishing New Message ##')
  log_info(body)

  client = Aws::SNS::Client.new
  response = client.publish(message_params)

  log_info('## Message Published ##')
  log_info(response)
end

private

def build_message(body)
  json = JSON.parse(body)
  "FROM: #{json['name']} \n" \
  "EMAIL: #{json['email']} \n" \
  "MESSAGE: #{json['message']}"
end

def log_info(event)
  event_logger.info(event)
end

def event_logger
  @event_logger ||= Logger.new($stdout)
end

# Sample event payload

# {"Records"=>
#   [{"messageId"=>"1f35d9bc-7846-4036-90d7-5972777085d2",
#     "receiptHandle"=>
#      "AQEBhn37dtlgikCNtpbPkNcjiulHMzJhG8f29TW+7FqRbZFkmi2JoCREmioxfy25cX2N0BWKF0eOVRlGXRS+IgGhj4yc+YJI4WHSPYhantRZgvgfZWjV4A4KwRbuJsOX98KR5I6aYQ/yAOdHmpD8pss0AeAlPTmuqZGODaIsGF5tJPBrnhUA0oi7nJ554lu19wXazmT1TCCNyioCJMSHGdOScqt1l/4RIJBBycvi6VAHntnHnzBURwLClpd54OgLwCNavzDGlzndFJmZq4jm+8idWgKOMfW5+CppwlOHC6IdMgbSKv5Nj1pWjBAwZxYKdNSx7Dj+Tpj3Ht1MeGz0Cg40uLPdYK9elrevMKiRTRSrdL9jg0b9FrhOAd++Jb+ea/w8dB/uPnNfcPHjvuGOjiYBrtsy4MxM/N6zXwBa6EFO/FpvNZ8T0Lu2sfCJat8p6+Xx",
#     "body"=>"{\"name\": \"Test name\", \"email\": \"email@example.com\", \"message\": \"Test message\"}",
#     "attributes"=>{"ApproximateReceiveCount"=>"200", "SentTimestamp"=>"1667426609391", "SenderId"=>"AIDAUUBFDJHDNOSYBIOWY", "ApproximateFirstReceiveTimestamp"=>"1667426609391"},
#     "messageAttributes"=>{},
#     "md5OfBody"=>"c40fd43c09a599e73d6d1d257070c300",
#     "eventSource"=>"aws:sqs",
#     "eventSourceARN"=>"arn:aws:sqs:eu-central-1:317905390022:ResumeCdkStack-EmailSqsQueue2D18F543-ArdPrtk25Zh8",
#     "awsRegion"=>"eu-central-1"}]}
