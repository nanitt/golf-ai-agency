import { createClient } from '@supabase/supabase-js';

const VALID_STATUSES = ['new', 'contacted', 'converted', 'archived'];

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Initialize at runtime
  const ADMIN_KEY = process.env.ADMIN_KEY || 'landings2026';

  // Basic auth check
  const authHeader = req.headers.authorization;
  const providedKey = authHeader?.replace('Bearer ', '');

  if (providedKey !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // PATCH - Update lead status or notes
  if (req.method === 'PATCH') {
    try {
      const { id, status, notes } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Lead ID is required' });
      }

      const updateData = { updated_at: new Date().toISOString() };

      if (status) {
        if (!VALID_STATUSES.includes(status)) {
          return res.status(400).json({
            error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`
          });
        }
        updateData.status = status;
      }

      if (notes !== undefined) {
        updateData.notes = notes;
      }

      const { data: lead, error } = await supabase
        .from('landings_leads')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return res.status(200).json({
        success: true,
        lead
      });

    } catch (error) {
      console.error('Update lead error:', error);
      return res.status(500).json({
        error: 'Failed to update lead',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // GET - Fetch leads with optional filters
  if (req.method === 'GET') {
    try {
      const { search, status, block, from, to } = req.query;

      let query = supabase
        .from('landings_leads')
        .select('*')
        .order('created_at', { ascending: false });

      // Search by name or email
      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      // Filter by status
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      // Filter by block preference
      if (block && block !== 'all') {
        query = query.eq('block_preference', block);
      }

      // Date range filters
      if (from) {
        query = query.gte('created_at', from);
      }
      if (to) {
        query = query.lte('created_at', to + 'T23:59:59');
      }

      const { data: leads, error } = await query.limit(500);

      if (error) {
        throw error;
      }

      // Calculate stats
      const allLeads = leads || [];
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const stats = {
        total: allLeads.length,
        thisWeek: allLeads.filter(l => new Date(l.created_at) >= oneWeekAgo).length,
        byStatus: {
          new: allLeads.filter(l => l.status === 'new').length,
          contacted: allLeads.filter(l => l.status === 'contacted').length,
          converted: allLeads.filter(l => l.status === 'converted').length,
          archived: allLeads.filter(l => l.status === 'archived').length
        },
        byBlock: {
          block1: allLeads.filter(l => l.block_preference === 'block1' || l.block_preference === 'both' || l.block_preference === 'full').length,
          block2: allLeads.filter(l => l.block_preference === 'block2' || l.block_preference === 'both' || l.block_preference === 'full').length,
          full: allLeads.filter(l => l.block_preference === 'full').length
        },
        conversionRate: allLeads.length > 0
          ? Math.round((allLeads.filter(l => l.status === 'converted').length / allLeads.length) * 100)
          : 0
      };

      return res.status(200).json({
        success: true,
        count: leads.length,
        stats,
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

  return res.status(405).json({ error: 'Method not allowed' });
}
