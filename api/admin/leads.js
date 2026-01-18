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

  // Initialize at runtime
  const ADMIN_KEY = process.env.ADMIN_KEY || 'landings2026';

  // Basic auth check
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

    const { data: leads, error } = await supabase
      .from('landings_leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    return res.status(200).json({
      success: true,
      count: leads.length,
      leads
    });

  } catch (error) {
    console.error('Admin leads error:', error);
    return res.status(500).json({
      error: 'Failed to fetch leads',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
