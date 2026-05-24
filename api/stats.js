import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '../lib/rateLimit.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Cache for 5 minutes
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 20 requests per minute
  if (!rateLimit(req, res, 'stats', 20)) {
    return;
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get total registrations (non-archived)
    const { count: totalLeads, error: totalError } = await supabase
      .from('landings_leads')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'archived');

    if (totalError) throw totalError;

    // Get registrations this week
    const { count: weekLeads, error: weekError } = await supabase
      .from('landings_leads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneWeekAgo.toISOString())
      .neq('status', 'archived');

    if (weekError) throw weekError;

    // Get most recent registration
    const { data: latestLead, error: latestError } = await supabase
      .from('landings_leads')
      .select('created_at')
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Calculate "X hours ago" for latest registration
    let lastRegistrationText = null;
    if (latestLead && !latestError) {
      const lastTime = new Date(latestLead.created_at);
      const hoursAgo = Math.floor((now - lastTime) / (60 * 60 * 1000));

      if (hoursAgo < 1) {
        lastRegistrationText = 'Just now';
      } else if (hoursAgo < 24) {
        lastRegistrationText = `${hoursAgo} hour${hoursAgo === 1 ? '' : 's'} ago`;
      } else {
        const daysAgo = Math.floor(hoursAgo / 24);
        lastRegistrationText = `${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`;
      }
    }

    // Get registrations in last 24 hours for urgency
    const { count: recentLeads } = await supabase
      .from('landings_leads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo.toISOString())
      .neq('status', 'archived');

    return res.status(200).json({
      success: true,
      stats: {
        total: totalLeads || 0,
        thisWeek: weekLeads || 0,
        last24Hours: recentLeads || 0,
        lastRegistration: lastRegistrationText
      }
    });

  } catch (error) {
    console.error('Stats error:', error);
    return res.status(500).json({
      error: 'Failed to fetch stats',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
