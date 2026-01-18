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
├── index.html              # Demo landing page (with pricing, FAQ, facilities, hours, social proof)
├── admin.html              # Lead dashboard (with search, filter, export, bulk actions, tags, scoring)
├── public/widget.js        # Embeddable chat widget (localStorage, validation, exit-intent, analytics)
├── api/
│   ├── chat.js             # OpenAI proxy - POST /api/chat (rate limited, lead scoring)
│   ├── leads.js            # Lead capture - POST /api/leads (rate limited, validation, scoring)
│   ├── stats.js            # Public stats endpoint - GET /api/stats (social proof)
│   ├── events.js           # Analytics events - POST /api/events
│   └── admin/leads.js      # Admin API - GET/PATCH/DELETE /api/admin/leads (bulk ops, tags)
├── lib/
│   ├── openai.js           # OpenAI client
│   ├── supabase.js         # Supabase client
│   ├── email.js            # Resend email client
│   └── rateLimit.js        # Rate limiting utility
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
  score INTEGER DEFAULT 0,
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_landings_leads_created_at ON landings_leads(created_at DESC);
CREATE INDEX idx_landings_leads_status ON landings_leads(status);
CREATE INDEX idx_landings_leads_email ON landings_leads(email);
CREATE INDEX idx_landings_leads_score ON landings_leads(score);
ALTER TABLE landings_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can do everything" ON landings_leads
  FOR ALL USING (true) WITH CHECK (true);

-- Analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  session_id TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_created ON analytics_events(created_at DESC);
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can do everything" ON analytics_events
  FOR ALL USING (true) WITH CHECK (true);
```

**Migration for existing tables (run these if upgrading):**
```sql
-- Add lead scoring
ALTER TABLE landings_leads ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0;

-- Add tags
ALTER TABLE landings_leads ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';

-- Add notes column if missing
ALTER TABLE landings_leads ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add score index for hot leads filtering
CREATE INDEX IF NOT EXISTS idx_landings_leads_score ON landings_leads(score);

-- Create analytics_events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  session_id TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at DESC);
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
- `POST /api/chat` - Send message, get AI response (rate limited: 10/min/IP)
- `POST /api/leads` - Submit lead (name, email, block) with validation (rate limited: 5/min/IP, 3/day/email)
- `GET /api/stats` - Public stats for social proof (thisWeek, lastRegistration)
- `POST /api/events` - Track analytics events (widget_open, message_sent, lead_submitted, form_abandoned, exit_intent_shown)
- `GET /api/admin/leads` - Get leads with filters (?search=&status=&block=&tag=&from=&to=&hot_leads=true&needs_followup=true)
- `PATCH /api/admin/leads` - Update lead (body: {id, status?, notes?, tags?, addTag?, removeTag?}) or bulk update (body: {ids[], status})
- `DELETE /api/admin/leads` - Delete lead(s) (?id=single or ?ids=comma,separated or ?email=for-gdpr)

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

## V2 Features (Comprehensive Upgrade)

### UX Improvements (Widget)
- **Conversation Persistence**: localStorage with 24-hour TTL, "Welcome back!" for returning users
- **Real-time Form Validation**: Inline validation with green checkmarks, email regex, disabled submit until valid
- **Message Timestamps**: Shows timestamps between messages >1 min apart
- **Mobile Keyboard Handling**: visualViewport detection, dynamic height adjustment
- **Privacy Consent**: Checkbox before form submission, stores consent flag

### Conversion Optimization
- **Social Proof Stats**: "X registered this week" and "Last registration: X hours ago" on landing page
- **Exit-Intent Capture**: Desktop-only popup when mouse leaves viewport (once per session)
- **Lead Scoring**: Automatic scoring based on conversation keywords (pricing +5, instructors +10, signup +15, etc.)

### Admin Productivity
- **Bulk Actions**: Select multiple leads, bulk status update, bulk delete with confirmation
- **Lead Tags**: 6 predefined tags (follow_up, referred, needs_discount, vip, junior, returning), filter by tag
- **Follow-up Reminders**: "Needs Follow-up" badge for leads not contacted in 3+ days, stale lead highlighting
- **Hot Leads Filter**: Quick filter for leads with score > 30

### Technical & Security
- **Rate Limiting**: In-memory rate limiter (10 msg/min/IP for chat, 5/min/IP + 3/day/email for leads)
- **Honeypot Field**: Hidden 'website' field to catch bots
- **API Retry Logic**: 3 retries with exponential backoff for OpenAI calls
- **Analytics Events**: Tracks widget_open, message_sent, lead_submitted, form_abandoned, exit_intent_shown
- **Data Erasure**: DELETE endpoint for GDPR-style data removal

### Lead Scoring Keywords
| Category | Keywords | Score |
|----------|----------|-------|
| Pricing | price, cost, how much, fee, payment | +5 |
| Instructors | instructor, coach, chris, michael, maddy | +10 |
| Signup Intent | sign up, register, join, enroll, book | +15 |
| Dates | when, date, schedule, january, february | +5 |
| Comparison | compare, difference, better, which | +8 |
| Facilities | facility, simulator, foresight | +5 |
| Urgency | available, spots left, hurry | +10 |

**Hot Lead Threshold**: Score > 30

### Valid Tags
- `follow_up` - Needs follow-up contact
- `referred` - Referred by existing member
- `needs_discount` - Asking about discounts
- `vip` - Priority/VIP customer
- `junior` - Junior golfer (under 18)
- `returning` - Returning customer

## Notes
- Widget is self-contained, no dependencies
- All API keys stay server-side only
- Admin dashboard uses simple key auth (ADMIN_KEY)
- Email from address: notifications@golfagency.ca (configure in Resend)
- Hours: Closed Fridays for maintenance
- Rate limiting is in-memory (resets on serverless cold start)
