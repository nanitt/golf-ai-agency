# The Landings Digital Front Desk - Project Context

## Project Overview
Lead-generation chatbot for The Landings Golf Course (Kingston) to capture registrations for the **2026 Indoor Winter Instructional Program**.

**Goal:** Demo this to The Landings management, using celticgolfkingston.ca as proof of technical capabilities.

## Program Details
| Block | Dates | Duration |
|-------|-------|----------|
| Block 1 | January 12 - February 15, 2026 | 5 weeks |
| Block 2 | February 16 - March 22, 2026 | 5 weeks |
| Full Program | January 12 - March 22, 2026 | 10 weeks |

**Pricing:**
- Full 10-Week: $695 adult / $549 junior
- Block 1: $379 adult / $289 junior
- Block 2: $439 adult / $359 junior

**Instructors:** Chris Barber (Head Pro, PGA of Canada), Michael Beneteau (TPI Certified), Maddy Barber (PGA of Canada)
**Follow-up:** Chris contacts registrants directly

## Tech Stack
- **Frontend:** Vanilla JS embeddable widget (`public/widget.js`)
- **Backend:** Vercel serverless functions (`api/`)
- **AI:** OpenAI GPT-4o-mini
- **Database:** Supabase (`landings_leads` table)
- **Email:** Resend (notifications@golfagency.ca)
- **Hosting:** Vercel (free tier)

## Project Structure
```
/Users/natemaclennan/projects/golf-ai-agency/
├── index.html              # Demo landing page (with pricing, FAQ, facilities, hours)
├── admin.html              # Lead dashboard (with search, filter, export, status update)
├── public/widget.js        # Embeddable chat widget (no secrets)
├── api/
│   ├── chat.js             # OpenAI proxy - POST /api/chat
│   ├── leads.js            # Lead capture - POST /api/leads (with validation)
│   └── admin/leads.js      # Admin API - GET/PATCH /api/admin/leads
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
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_landings_leads_created_at ON landings_leads(created_at DESC);
CREATE INDEX idx_landings_leads_status ON landings_leads(status);
CREATE INDEX idx_landings_leads_email ON landings_leads(email);
ALTER TABLE landings_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can do everything" ON landings_leads
  FOR ALL USING (true) WITH CHECK (true);
```

**Note:** Run this to add notes column if table already exists:
```sql
ALTER TABLE landings_leads ADD COLUMN IF NOT EXISTS notes TEXT;
```

## Deployment Status
- [x] Dependencies installed (`npm install`)
- [x] .env file created with real keys
- [x] Supabase table created
- [x] Deployed to Vercel
- [x] Environment variables added to Vercel
- [x] Tested chat functionality
- [x] Lead capture with validation
- [x] Duplicate email prevention
- [x] Email notifications (navy/gold branding)
- [x] Admin status updates (PATCH endpoint)
- [x] Admin search/filter functionality
- [x] Admin CSV export
- [x] Lead detail modal with conversation history
- [x] Landing page: Pricing section
- [x] Landing page: Facilities section
- [x] Landing page: FAQ accordion
- [x] Landing page: Hours of operation
- [x] Full 10-week option in widget

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
- `POST /api/leads` - Submit lead (name, email, block) with validation
- `GET /api/admin/leads` - Get all leads with optional filters (?search=&status=&block=&from=&to=)
- `PATCH /api/admin/leads` - Update lead status or notes (body: {id, status?, notes?})

## Block Preference Values
- `full` - Full 10-Week Program (Best Value)
- `block1` - Block 1 only
- `block2` - Block 2 only
- `both` - Both blocks
- `undecided` - Not sure yet

## Lead Statuses
- `new` - Just registered, not contacted
- `contacted` - Chris has reached out
- `converted` - Paid and enrolled
- `archived` - No longer active

## Features Implemented (Demo Prep - Jan 17, 2026)

### Lead Capture (api/leads.js)
- Email validation
- Block preference validation (block1, block2, both, full, undecided)
- Duplicate email prevention with friendly message
- Navy/gold branded email notifications
- Email from: notifications@golfagency.ca

### Admin Dashboard (admin.html)
- Navy/gold branding consistent with landing page
- Search by name or email (with debounce)
- Filter by status, block preference, date range
- Status dropdown in table rows for quick updates
- Lead detail modal with:
  - Contact information
  - Status update
  - Notes field (saved to database)
  - Full conversation history
- CSV export of filtered leads
- Stats: Total, This Week, Block 1/2, New, Conversion Rate

### Landing Page (index.html)
- Pricing section with all options (full, block 1, block 2)
- Facilities section (ForeSight, simulator, unlimited practice, TPI)
- Hours of operation for both blocks
- FAQ accordion with common questions
- Enhanced instructor cards with credentials and bios

### Widget (public/widget.js)
- Full 10-week program option added
- Engaging welcome message mentioning limited spots
- Graceful handling of duplicate email submissions

## Related Projects
- **Celtic Golf Kingston:** celticgolfkingston.ca - Full booking platform (Next.js, Supabase, Resend, Twilio)

## Notes
- Widget is self-contained, no dependencies
- All API keys stay server-side only
- Admin dashboard uses simple key auth (ADMIN_KEY)
- Email from address: notifications@golfagency.ca (configure in Resend)
- Hours: Closed Fridays for maintenance
