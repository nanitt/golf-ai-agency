import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  console.warn('Missing RESEND_API_KEY - email notifications will be disabled');
}

export const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function sendNotification(to, subject, html) {
  if (!resend) {
    console.log('Email skipped (no API key):', { to, subject });
    return null;
  }

  return resend.emails.send({
    from: 'The Landings Chatbot <notifications@golfagency.ca>',
    to,
    subject,
    html
  });
}

export default resend;
