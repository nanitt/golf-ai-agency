import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const VALID_STATUSES = ['new', 'contacted', 'converted', 'archived'];
const VALID_TAGS = ['follow_up', 'referred', 'needs_discount', 'vip', 'junior', 'returning'];

// AI Summary cache (in-memory, resets on cold start)
const summaryCache = new Map();

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
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

  // DELETE - Delete lead(s) for data erasure
  if (req.method === 'DELETE') {
    try {
      const { id, ids, email } = req.query;

      // Delete by single ID
      if (id) {
        const { error } = await supabase
          .from('landings_leads')
          .delete()
          .eq('id', id);

        if (error) throw error;
        return res.status(200).json({ success: true, deleted: 1 });
      }

      // Delete by multiple IDs (bulk delete)
      if (ids) {
        const idArray = ids.split(',');
        const { error } = await supabase
          .from('landings_leads')
          .delete()
          .in('id', idArray);

        if (error) throw error;
        return res.status(200).json({ success: true, deleted: idArray.length });
      }

      // Delete by email (for GDPR data erasure requests)
      if (email) {
        const { data, error } = await supabase
          .from('landings_leads')
          .delete()
          .eq('email', email.toLowerCase())
          .select('id');

        if (error) throw error;
        return res.status(200).json({
          success: true,
          deleted: data?.length || 0,
          message: `All data for ${email} has been erased`
        });
      }

      return res.status(400).json({ error: 'Provide id, ids, or email to delete' });

    } catch (error) {
      console.error('Delete lead error:', error);
      return res.status(500).json({
        error: 'Failed to delete lead(s)',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // POST - Generate AI summary of conversation
  if (req.method === 'POST') {
    try {
      const { action, leadId } = req.body;

      if (action !== 'summarize' || !leadId) {
        return res.status(400).json({ error: 'Invalid request. Use action: "summarize" with leadId.' });
      }

      // Check cache first
      if (summaryCache.has(leadId)) {
        return res.status(200).json({
          success: true,
          summary: summaryCache.get(leadId),
          cached: true
        });
      }

      // Fetch the lead's conversation history
      const { data: lead, error: leadError } = await supabase
        .from('landings_leads')
        .select('conversation_history, name, block_preference')
        .eq('id', leadId)
        .single();

      if (leadError || !lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      const messages = lead.conversation_history;
      if (!messages || messages.length === 0) {
        return res.status(200).json({
          success: true,
          summary: { topics: [], sentiment: 'neutral', summary: 'No conversation history available.' }
        });
      }

      // Generate AI summary
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const conversationText = messages
        .map(m => `${m.role === 'user' ? 'Customer' : 'Bot'}: ${m.content}`)
        .join('\n');

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an assistant that summarizes sales conversations for a golf course's winter instructional program. Analyze the conversation and provide:
1. Key topics discussed (array of short phrases)
2. Overall sentiment (positive, neutral, or negative)
3. A brief 2-3 sentence summary highlighting the lead's interests and any concerns

Respond in JSON format:
{
  "topics": ["topic1", "topic2"],
  "sentiment": "positive|neutral|negative",
  "summary": "Brief summary here"
}`
          },
          {
            role: 'user',
            content: `Summarize this conversation with ${lead.name} (interested in ${lead.block_preference}):\n\n${conversationText}`
          }
        ],
        temperature: 0.3,
        max_tokens: 300
      });

      let summary;
      try {
        summary = JSON.parse(response.choices[0].message.content);
      } catch {
        summary = {
          topics: [],
          sentiment: 'neutral',
          summary: response.choices[0].message.content
        };
      }

      // Cache the summary
      summaryCache.set(leadId, summary);

      return res.status(200).json({
        success: true,
        summary,
        cached: false
      });

    } catch (error) {
      console.error('Summary generation error:', error);
      return res.status(500).json({
        error: 'Failed to generate summary',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // PATCH - Update lead status, notes, tags (single or bulk)
  if (req.method === 'PATCH') {
    try {
      const { id, ids, status, notes, tags, addTag, removeTag } = req.body;

      // Bulk update
      if (ids && Array.isArray(ids) && ids.length > 0) {
        const updateData = { updated_at: new Date().toISOString() };

        if (status) {
          if (!VALID_STATUSES.includes(status)) {
            return res.status(400).json({
              error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`
            });
          }
          updateData.status = status;
        }

        const { data: leads, error } = await supabase
          .from('landings_leads')
          .update(updateData)
          .in('id', ids)
          .select();

        if (error) throw error;

        return res.status(200).json({
          success: true,
          updated: leads?.length || 0
        });
      }

      // Single update
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

      // Handle tags update
      if (tags !== undefined) {
        // Direct tags array replacement
        const validTags = tags.filter(t => VALID_TAGS.includes(t));
        updateData.tags = validTags;
      } else if (addTag || removeTag) {
        // Fetch current tags first
        const { data: currentLead } = await supabase
          .from('landings_leads')
          .select('tags')
          .eq('id', id)
          .single();

        let currentTags = currentLead?.tags || [];

        if (addTag && VALID_TAGS.includes(addTag) && !currentTags.includes(addTag)) {
          currentTags = [...currentTags, addTag];
        }

        if (removeTag && currentTags.includes(removeTag)) {
          currentTags = currentTags.filter(t => t !== removeTag);
        }

        updateData.tags = currentTags;
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

  // GET - Fetch leads with optional filters and pagination
  if (req.method === 'GET') {
    try {
      const { search, status, block, from, to, tag, hot_leads, needs_followup, page, limit } = req.query;

      // Pagination settings
      const pageNum = Math.max(1, parseInt(page) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 25));
      const offset = (pageNum - 1) * pageSize;

      // Build count query (same filters, no pagination)
      let countQuery = supabase
        .from('landings_leads')
        .select('*', { count: 'exact', head: true });

      // Build data query
      let query = supabase
        .from('landings_leads')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters to both queries
      const applyFilters = (q) => {
        // Search by name or email
        if (search) {
          q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
        }

        // Filter by status
        if (status && status !== 'all') {
          q = q.eq('status', status);
        }

        // Filter by block preference
        if (block && block !== 'all') {
          q = q.eq('block_preference', block);
        }

        // Date range filters
        if (from) {
          q = q.gte('created_at', from);
        }
        if (to) {
          q = q.lte('created_at', to + 'T23:59:59');
        }

        // Filter by tag
        if (tag && tag !== 'all') {
          q = q.contains('tags', [tag]);
        }

        // Filter for hot leads (score > 30)
        if (hot_leads === 'true') {
          q = q.gt('score', 30);
        }

        // Filter for needs follow-up (new or status=new, not contacted in 3+ days)
        if (needs_followup === 'true') {
          const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
          q = q.eq('status', 'new').lt('created_at', threeDaysAgo);
        }

        return q;
      };

      query = applyFilters(query);
      countQuery = applyFilters(countQuery);

      // Get total count for pagination
      const { count: totalCount, error: countError } = await countQuery;
      if (countError) throw countError;

      // Apply pagination
      const { data: leads, error } = await query.range(offset, offset + pageSize - 1);

      if (error) {
        throw error;
      }

      // Calculate stats (fetch all leads for accurate stats)
      const { data: allLeadsForStats } = await supabase
        .from('landings_leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      const allLeads = allLeadsForStats || [];
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      // Calculate needs follow-up count
      const needsFollowupCount = allLeads.filter(l =>
        l.status === 'new' && new Date(l.created_at) < threeDaysAgo
      ).length;

      // Calculate hot leads count
      const hotLeadsCount = allLeads.filter(l => (l.score || 0) > 30).length;

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
          : 0,
        needsFollowup: needsFollowupCount,
        hotLeads: hotLeadsCount,
        validTags: VALID_TAGS
      };

      // Calculate pagination metadata
      const totalPages = Math.ceil((totalCount || 0) / pageSize);

      return res.status(200).json({
        success: true,
        count: leads.length,
        pagination: {
          page: pageNum,
          limit: pageSize,
          total: totalCount || 0,
          totalPages,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1
        },
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
