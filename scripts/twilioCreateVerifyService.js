import 'dotenv/config';
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  console.error('TWILIO_ACCOUNT_SID veya TWILIO_AUTH_TOKEN eksik.');
  process.exit(1);
}

const client = twilio(accountSid, authToken);

const run = async () => {
  const service = await client.verify.v2.services.create({ friendlyName: 'Talepet Verify' });
  console.log('TWILIO_VERIFY_SERVICE_SID=', service.sid);
};

run().catch((error) => {
  console.error('Verify service olusturma hatasi:', error?.message || error);
  process.exit(1);
});
