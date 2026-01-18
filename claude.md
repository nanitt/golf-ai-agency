# The Landings Digital Front Desk - Project Context

## Project Overview
Lead-generation chatbot for The Landings Golf Course (Kingston) to capture registrations for the **2026 Indoor Winter Instructional Program**.

**Goal:** Demo this to The Landings management, using celticgolfkingston.ca as proof of technical capabilities.

## Program Details
| Block | Dates | Duration |
|-------|-------|----------|
| Block 1 | January 12 - February 15, 2026 | 5 weeks |
| Block 2 | February 16 - March 22, 2026 | 5 weeks |

**Instructors:** Chris Barber (Head Pro), Michael Beneteau, Maddy Barber
**Follow-up:** Chris contacts registrants directly

## Tech Stack
- **Frontend:** Vanilla JS embeddable widget (`public/widget.js`)
- **Backend:** Vercel serverless functions (`api/`)
- **AI:** OpenAI GPT-4o-mini
- **Database:** Supabase (`landings_leads` table)
- **Email:** Resend (notifications to natemaclennan@outlook.com, later Chris)
- **Hosting:** Vercel (free tier)

## Project Structure
```
/Users/natemaclennan/projects/golf-ai-agency/
├── index.html              # Demo landing page
├── admin.html              # Lead dashboard (access at /admin.html)
├── public/widget.js        # Embeddable chat widget (no secrets)
├── api/
│   ├── chat.js             # OpenAI proxy - POST /api/chat
│   ├── leads.js            # Lead capture - POST /api/leads
│   └── admin/leads.js      # Admin API - GET /api/admin/leads
├── lib/
│   ├── openai.js           # OpenAI client
│   ├── supabase.js         # Supabase client
│   └── email.js            # Resend email client
├── package.json
├── vercel.json
├── .env.example
├── .gitignore
└── README.md
```

## Environment Variables Required
```
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
RESEND_API_KEY=re_...
NOTIFICATION_EMAIL=natemaclennan@outlook.com
ADMIN_KEY=your-secure-admin-key
```

## Supabase Table SQL
```sql
CREATE TABLE landings_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  block_preference TEXT NOT NULL,
  conversation_id TEXT,
  conversation_history JSONB,
  source TEXT DEFAULT 'chatbot',
  status TEXT DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_landings_leads_created_at ON landings_leads(created_at DESC);
CREATE INDEX idx_landings_leads_status ON landings_leads(status);
ALTER TABLE landings_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can do everything" ON landings_leads
  FOR ALL USING (true) WITH CHECK (true);
```

## Deployment Status
- [x] Dependencies installed (`npm install`)
- [x] .env file created with real keys
- [x] Supabase table created
- [x] Deployed to Vercel
- [x] Environment variables added to Vercel
- [x] Tested chat functionality
- [ ] Tested lead capture (form submission)
- [ ] Tested email notifications

## Live URLs
- **Demo Site:** https://golf-ai-agency.vercel.app
- **Admin Dashboard:** https://golf-ai-agency.vercel.app/admin.html (key: landings2026admin)
- **GitHub:** https://github.com/nanitt/golf-ai-agency

## Embed Code (for WordPress)
```html
<script>
  window.LANDINGS_API_BASE = 'https://golf-ai-agency.vercel.app';
</script>
<script src="https://golf-ai-agency.vercel.app/public/widget.js"></script>
```

## API Endpoints
- `POST /api/chat` - Send message, get AI response
- `POST /api/leads` - Submit lead (name, email, block)
- `GET /api/admin/leads` - Get all leads (requires Authorization header)

## Related Projects
- **Celtic Golf Kingston:** celticgolfkingston.ca - Full booking platform (Next.js, Supabase, Resend, Twilio)

## Notes
- Widget is self-contained, no dependencies
- All API keys stay server-side only
- Admin dashboard uses simple key auth (ADMIN_KEY)
- Email from address: notifications@golfagency.ca (configure in Resend)
