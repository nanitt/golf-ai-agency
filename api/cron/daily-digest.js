import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const BLOCK_LABELS = {
  block1: 'Block 1',
  block2: 'Block 2',
  both: 'Both Blocks',
  full: 'Full 10-Week',
  undecided: 'Undecided'
};

export default async function handler(req, res) {
  // Only allow GET requests (Vercel cron uses GET)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify cron secret (Vercel sends this in Authorization header)
  const authHeader = req.headers.authorization;
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (process.env.CRON_SECRET && authHeader !== expectedAuth) {
    console.error('Unauthorized cron request');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Initialize clients
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    const resend = new Resend(process.env.RESEND_API_KEY);
    const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL || 'natemaclennan@outlook.com';

    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Query leads from last 24 hours
    const { data: leads, error: dbError } = await supabase
      .from('landings_leads')
      .select('id, name, email, block_preference, created_at')
      .gte('created_at', twentyFourHoursAgo.toISOString())
      .order('created_at', { ascending: false });

    if (dbError) {
      console.error('Supabase error:', dbError);
      throw new Error('Failed to fetch leads');
    }

    // Skip if no new leads
    if (!leads || leads.length === 0) {
      console.log('Daily digest: No new leads in last 24 hours');
      return res.status(200).json({
        success: true,
        message: 'No new leads to report',
        count: 0
      });
    }

    // Format the email
    const leadsTableRows = leads.map(lead => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #DBCDA5;">${escapeHtml(lead.name)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #DBCDA5;">
          <a href="mailto:${escapeHtml(lead.email)}" style="color: #093658;">${escapeHtml(lead.email)}</a>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #DBCDA5;">${BLOCK_LABELS[lead.block_preference] || lead.block_preference}</td>
        <td style="padding: 12px; border-bottom: 1px solid #DBCDA5;">${formatTime(lead.created_at)}</td>
      </tr>
    `).join('');

    // Send digest email
    const { error: emailError } = await resend.emails.send({
      from: 'The Landings Golf <notifications@golfagency.ca>',
      to: NOTIFICATION_EMAIL,
      subject: `Daily Lead Summary - The Landings (${leads.length} new lead${leads.length === 1 ? '' : 's'})`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 700px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #0e2a42 0%, #093658 100%); padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: #DBCDA5; margin: 0; font-size: 24px;">Daily Lead Summary</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0;">The Landings Winter Instructional Program 2026</p>
          </div>

          <div style="background: #F5F0E4; padding: 24px; border: 1px solid #DBCDA5; border-top: none;">
            <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
              <span style="font-size: 48px; font-weight: bold; color: #093658;">${leads.length}</span>
              <p style="margin: 4px 0 0; color: #666;">New Lead${leads.length === 1 ? '' : 's'} in Last 24 Hours</p>
            </div>

            <h2 style="color: #093658; margin: 0 0 16px; font-size: 18px;">Lead Details</h2>

            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px;">
                <thead>
                  <tr style="background: #093658; color: white;">
                    <th style="padding: 12px; text-align: left; border-radius: 8px 0 0 0;">Name</th>
                    <th style="padding: 12px; text-align: left;">Email</th>
                    <th style="padding: 12px; text-align: left;">Block</th>
                    <th style="padding: 12px; text-align: left; border-radius: 0 8px 0 0;">Time</th>
                  </tr>
                </thead>
                <tbody>
                  ${leadsTableRows}
                </tbody>
              </table>
            </div>
          </div>

          <div style="background: white; padding: 20px; border: 1px solid #DBCDA5; border-top: none; border-radius: 0 0 8px 8px; text-align: center;">
            <a href="https://golf-ai-agency.vercel.app/admin"
               style="display: inline-block; background: #093658; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
              View Admin Dashboard
            </a>
          </div>

          <div style="padding: 16px; text-align: center; color: #666; font-size: 12px;">
            <p>This is an automated daily digest from The Landings Digital Front Desk.</p>
            <p style="margin-top: 8px; color: #DBCDA5;">Powered by Golf AI Agency</p>
          </div>
        </div>
      `
    });

    if (emailError) {
      console.error('Email error:', emailError);
      throw new Error('Failed to send digest email');
    }

    console.log(`Daily digest sent: ${leads.length} leads`);
    return res.status(200).json({
      success: true,
      message: `Digest sent with ${leads.length} lead(s)`,
      count: leads.length
    });

  } catch (error) {
    console.error('Daily digest error:', error);
    return res.status(500).json({
      error: 'Failed to send daily digest',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    timeZone: 'America/Toronto',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}
