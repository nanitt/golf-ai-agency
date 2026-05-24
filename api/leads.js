import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { rateLimit, checkEmailRateLimit, isLikelyBot, getClientIP } from '../lib/rateLimit.js';
import { sendSlackNotification } from '../lib/slack.js';

const BLOCK_LABELS = {
  block1: 'Block 1: January 12 - February 15, 2026',
  block2: 'Block 2: February 16 - March 22, 2026',
  both: 'Both Blocks',
  full: 'Full 10-Week Program',
  undecided: 'Not Sure Yet'
};

const VALID_BLOCKS = ['block1', 'block2', 'both', 'full', 'undecided'];

// Lead scoring keywords (same as chat.js for consistency)
const SCORING_KEYWORDS = {
  pricing: { keywords: ['price', 'cost', 'how much', 'fee', 'payment', 'pay', 'afford', '$'], score: 5 },
  instructors: { keywords: ['instructor', 'teacher', 'coach', 'professional', 'pro', 'chris', 'michael', 'maddy'], score: 10 },
  signup: { keywords: ['sign up', 'signup', 'register', 'join', 'enroll', 'book', 'reserve', 'spot', 'interested'], score: 15 },
  dates: { keywords: ['when', 'date', 'schedule', 'start', 'january', 'february', 'march', 'block 1', 'block 2'], score: 5 },
  comparison: { keywords: ['compare', 'difference', 'better', 'which', 'recommend'], score: 8 },
  facilities: { keywords: ['facility', 'simulator', 'foresight', 'launch monitor', 'equipment'], score: 5 },
  urgency: { keywords: ['available', 'spots left', 'full', 'hurry', 'soon', 'deadline'], score: 10 }
};

// Calculate conversation score
function calculateConversationScore(messages) {
  if (!messages || !Array.isArray(messages)) return 0;

  let totalScore = 0;
  for (const msg of messages) {
    if (msg.role === 'user' && msg.content) {
      const messageLower = msg.content.toLowerCase();
      for (const category of Object.values(SCORING_KEYWORDS)) {
        for (const keyword of category.keywords) {
          if (messageLower.includes(keyword)) {
            totalScore += category.score;
            break;
          }
        }
      }
    }
  }
  return totalScore;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 5 lead submissions per minute per IP
  if (!rateLimit(req, res, 'leads', 5)) {
    return;
  }

  try {
    // Initialize clients at runtime to ensure env vars are available
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    const resend = new Resend(process.env.RESEND_API_KEY);
    const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL || 'natemaclennan@outlook.com';

    const { name, email, block, conversationId, messages, consent, website } = req.body;

    // Honeypot check - if 'website' field is filled, it's likely a bot
    if (isLikelyBot({ website })) {
      // Return success to not reveal detection
      return res.status(200).json({ success: true, leadId: 'filtered' });
    }

    // Validation
    if (!name || !email || !block) {
      return res.status(400).json({ error: 'Name, email, and block preference are required' });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Block preference validation
    if (!VALID_BLOCKS.includes(block)) {
      return res.status(400).json({ error: 'Invalid block preference. Choose: block1, block2, both, full, or undecided' });
    }

    // Rate limit by email: max 3 submissions per day per email
    const emailRateCheck = checkEmailRateLimit(email);
    if (!emailRateCheck.allowed) {
      return res.status(429).json({
        error: 'Too many submissions',
        message: 'You have already registered. Chris will be in touch soon!'
      });
    }

    // Check for duplicate email
    const { data: existingLead } = await supabase
      .from('landings_leads')
      .select('id, name')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existingLead) {
      return res.status(409).json({
        error: 'duplicate_email',
        message: `It looks like ${email} is already registered. Chris will be in touch soon! If you need to update your information, please contact us directly.`
      });
    }

    // Calculate lead score from conversation
    const score = calculateConversationScore(messages);

    // Save to Supabase
    const { data: lead, error: dbError } = await supabase
      .from('landings_leads')
      .insert({
        name,
        email: email.toLowerCase(),
        block_preference: block,
        conversation_id: conversationId,
        conversation_history: messages,
        source: 'chatbot',
        status: 'new',
        score: score,
        tags: []
      })
      .select()
      .single();

    if (dbError) {
      console.error('Supabase error:', dbError);
      throw new Error('Failed to save lead');
    }

    // Send Slack notification (fire and forget)
    sendSlackNotification({
      name,
      email,
      block_preference: block,
      score,
      source: 'chatbot'
    }).catch(err => console.error('Slack notification failed:', err));

    // Send email notification
    try {
      await resend.emails.send({
        from: 'The Landings Golf <notifications@golfagency.ca>',
        to: NOTIFICATION_EMAIL,
        subject: `New Winter Program Interest: ${name}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #0e2a42 0%, #093658 100%); padding: 24px; border-radius: 8px 8px 0 0;">
              <h1 style="color: #DBCDA5; margin: 0; font-size: 24px;">New Registration Interest</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0;">The Landings Winter Instructional Program 2026</p>
            </div>

            <div style="background: #F5F0E4; padding: 24px; border: 1px solid #DBCDA5; border-top: none;">
              <h2 style="color: #093658; margin: 0 0 16px; font-size: 18px;">Contact Information</h2>

              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; width: 120px;">Name:</td>
                  <td style="padding: 8px 0; font-weight: 600; color: #0e2a42;">${escapeHtml(name)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Email:</td>
                  <td style="padding: 8px 0;"><a href="mailto:${escapeHtml(email)}" style="color: #093658; font-weight: 500;">${escapeHtml(email)}</a></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Block Preference:</td>
                  <td style="padding: 8px 0; font-weight: 600; color: #0e2a42;">${BLOCK_LABELS[block] || block}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Submitted:</td>
                  <td style="padding: 8px 0; color: #374151;">${new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' })}</td>
                </tr>
              </table>
            </div>

            ${messages && messages.length > 0 ? `
            <div style="background: white; padding: 24px; border: 1px solid #DBCDA5; border-top: none; border-radius: 0 0 8px 8px;">
              <h2 style="color: #093658; margin: 0 0 16px; font-size: 18px;">Conversation History</h2>
              <div style="background: #F5F0E4; padding: 16px; border-radius: 8px; font-size: 14px; line-height: 1.6;">
                ${messages.map(msg => `
                  <p style="margin: 8px 0;">
                    <strong style="color: ${msg.role === 'user' ? '#093658' : '#666'};">
                      ${msg.role === 'user' ? 'Visitor' : 'Bot'}:
                    </strong>
                    ${escapeHtml(msg.content)}
                  </p>
                `).join('')}
              </div>
            </div>
            ` : ''}

            <div style="padding: 16px; text-align: center; color: #666; font-size: 12px;">
              <p>This notification was sent by The Landings Digital Front Desk.</p>
              <p style="margin-top: 8px; color: #DBCDA5;">⛳ Powered by Golf AI Agency</p>
            </div>
          </div>
        `
      });
    } catch (emailError) {
      // Log but don't fail the request if email fails
      console.error('Email notification error:', emailError);
    }

    return res.status(200).json({
      success: true,
      leadId: lead.id
    });

  } catch (error) {
    console.error('Lead submission error:', error);
    return res.status(500).json({
      error: 'Failed to process registration',
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
