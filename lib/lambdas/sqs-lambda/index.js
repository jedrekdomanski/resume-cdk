const AWS = require('aws-sdk')
// Create client outside of handler to reuse
const lambda = new AWS.Lambda()

// Handler
exports.handler = async function(event, context) {
  try {
    if (!event.body)
      throw new Error('Properties name, email and message are required.');

    const { name, email, message } = JSON.parse(event.body) as ContactDetails;
    if (!name || !email || !message)
      throw new Error('Name, email and message are required');

    return await sendMessageToSqs({name, email, message});
  } catch (error: unknown) {
    console.log('ERROR is: ', error);
    if (error instanceof Error) {
      return JSON.stringify({ body: { error: error.message }, statusCode: 400 });
    }
    return JSON.stringify({
      body: { error: JSON.stringify(error) },
      statusCode: 400,
    });


  function sendMessageToSqs({ name, email,  message }: ContactDetails) {
    // Send message to SQS

    return JSON.stringify({
      body: { message: 'Message sent successfully' },
      statusCode: 200,
    });
  }
}
