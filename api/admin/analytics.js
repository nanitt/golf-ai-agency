import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check
  const ADMIN_KEY = process.env.ADMIN_KEY || 'landings2026';
  const authHeader = req.headers.authorization;
  const providedKey = authHeader?.replace('Bearer ', '');

  if (providedKey !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get analytics events from the last 30 days
    const { data: events, error: eventsError } = await supabase
      .from('analytics_events')
      .select('event_type, created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    if (eventsError) throw eventsError;

    // Get leads from the last 30 days
    const { data: leads, error: leadsError } = await supabase
      .from('landings_leads')
      .select('created_at, status, score')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    if (leadsError) throw leadsError;

    // Calculate funnel metrics
    const widgetOpens = events?.filter(e => e.event_type === 'widget_open').length || 0;
    const messagesSent = events?.filter(e => e.event_type === 'message_sent').length || 0;
    const leadsSubmitted = events?.filter(e => e.event_type === 'lead_submitted').length || 0;
    const formsAbandoned = events?.filter(e => e.event_type === 'form_abandoned').length || 0;
    const exitIntentsShown = events?.filter(e => e.event_type === 'exit_intent_shown').length || 0;

    // Calculate conversion rates
    const openToMessageRate = widgetOpens > 0 ? ((messagesSent / widgetOpens) * 100).toFixed(1) : 0;
    const messageToLeadRate = messagesSent > 0 ? ((leadsSubmitted / messagesSent) * 100).toFixed(1) : 0;
    const overallConversionRate = widgetOpens > 0 ? ((leadsSubmitted / widgetOpens) * 100).toFixed(1) : 0;

    // Group leads by day for chart
    const leadsByDay = {};
    const dateLabels = [];

    // Initialize all days in the range
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      dateLabels.push(dateKey);
      leadsByDay[dateKey] = 0;
    }

    // Count leads per day
    (leads || []).forEach(lead => {
      const dateKey = lead.created_at.split('T')[0];
      if (leadsByDay.hasOwnProperty(dateKey)) {
        leadsByDay[dateKey]++;
      }
    });

    const chartData = dateLabels.map(date => leadsByDay[date]);

    // Calculate score distribution
    const scoreDistribution = {
      cold: (leads || []).filter(l => (l.score || 0) <= 15).length,
      warm: (leads || []).filter(l => (l.score || 0) > 15 && (l.score || 0) <= 30).length,
      hot: (leads || []).filter(l => (l.score || 0) > 30).length
    };

    // Calculate status distribution
    const statusDistribution = {
      new: (leads || []).filter(l => l.status === 'new').length,
      contacted: (leads || []).filter(l => l.status === 'contacted').length,
      converted: (leads || []).filter(l => l.status === 'converted').length,
      archived: (leads || []).filter(l => l.status === 'archived').length
    };

    return res.status(200).json({
      success: true,
      analytics: {
        funnel: {
          widgetOpens,
          messagesSent,
          leadsSubmitted,
          formsAbandoned,
          exitIntentsShown
        },
        conversionRates: {
          openToMessage: parseFloat(openToMessageRate),
          messageToLead: parseFloat(messageToLeadRate),
          overall: parseFloat(overallConversionRate)
        },
        chart: {
          labels: dateLabels.map(d => {
            const date = new Date(d);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          }),
          data: chartData
        },
        scoreDistribution,
        statusDistribution,
        totals: {
          leads: leads?.length || 0,
          events: events?.length || 0
        }
      }
    });

  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({
      error: 'Failed to fetch analytics',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
