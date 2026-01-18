import { createClient } from '@supabase/supabase-js';
import { rateLimit, getClientIP } from '../lib/rateLimit.js';

const VALID_EVENT_TYPES = [
  'widget_open',
  'message_sent',
  'lead_submitted',
  'form_abandoned',
  'exit_intent_shown'
];

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

  // Rate limit: 30 events per minute per IP
  if (!rateLimit(req, res, 'events', 30)) {
    return; // Response already sent by rateLimit
  }

  try {
    const { event_type, session_id, metadata = {} } = req.body;

    // Validate event type
    if (!event_type || !VALID_EVENT_TYPES.includes(event_type)) {
      return res.status(400).json({
        error: 'Invalid event type',
        valid_types: VALID_EVENT_TYPES
      });
    }

    // Initialize Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Store event
    const { error: dbError } = await supabase
      .from('analytics_events')
      .insert({
        event_type,
        session_id: session_id || null,
        metadata: {
          ...metadata,
          ip: getClientIP(req),
          user_agent: req.headers['user-agent'] || null,
          referer: req.headers['referer'] || null
        }
      });

    if (dbError) {
      // Log but don't fail - analytics should be fire-and-forget
      console.error('Analytics event error:', dbError);
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    // Don't fail on analytics errors
    console.error('Analytics error:', error);
    return res.status(200).json({ success: true });
  }
}
