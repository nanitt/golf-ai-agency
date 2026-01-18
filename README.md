# The Landings Digital Front Desk

A lead-generation chatbot for The Landings Golf Course's 2026 Indoor Winter Instructional Program.

## Features

- AI-powered conversational interface using OpenAI GPT
- Lead capture form (Name, Email, Block preference)
- Automatic email notifications for new leads
- Embeddable widget for any website
- Mobile-responsive design

## Program Details

| Block | Dates | Duration |
|-------|-------|----------|
| Block 1 | January 12 - February 15, 2026 | 5 weeks |
| Block 2 | February 16 - March 22, 2026 | 5 weeks |

**Instructors:** Chris Barber, Michael Beneteau, Maddy Barber

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `OPENAI_API_KEY` - Get from [OpenAI Platform](https://platform.openai.com/api-keys)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Your Supabase service role key
- `RESEND_API_KEY` - Get from [Resend](https://resend.com/api-keys)
- `NOTIFICATION_EMAIL` - Email address for lead notifications

### 3. Create Supabase Table

Run this SQL in your Supabase SQL Editor:

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

-- Create index for faster queries
CREATE INDEX idx_landings_leads_created_at ON landings_leads(created_at DESC);
CREATE INDEX idx_landings_leads_status ON landings_leads(status);

-- Enable Row Level Security
ALTER TABLE landings_leads ENABLE ROW LEVEL SECURITY;

-- Create policy for service role access
CREATE POLICY "Service role can do everything" ON landings_leads
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

### 4. Run Locally

```bash
npm run dev
```

Visit `http://localhost:3000` to see the demo page.

## Deployment (Vercel)

### 1. Deploy to Vercel

```bash
npx vercel
```

### 2. Add Environment Variables

In your Vercel project settings, add all environment variables from `.env`.

### 3. Get Your Production URL

After deployment, Vercel will give you a URL like `https://your-project.vercel.app`.

## Embedding on WordPress

Add this code to your WordPress site (in a Custom HTML block or theme):

```html
<script>
  window.LANDINGS_API_BASE = 'https://your-vercel-deployment.vercel.app';
</script>
<script src="https://your-vercel-deployment.vercel.app/public/widget.js"></script>
```

Replace `your-vercel-deployment.vercel.app` with your actual Vercel URL.

## File Structure

```
golf-ai-agency/
├── index.html          # Demo landing page
├── public/
│   └── widget.js       # Embeddable chat widget (no secrets)
├── api/
│   ├── chat.js         # OpenAI proxy endpoint
│   └── leads.js        # Lead capture + email endpoint
├── lib/
│   ├── openai.js       # OpenAI client
│   ├── supabase.js     # Supabase client
│   └── email.js        # Resend email client
├── package.json
├── .env.example        # Environment template
├── .gitignore
└── README.md
```

## API Endpoints

### POST /api/chat

Send a message to the chatbot.

**Request:**
```json
{
  "message": "What are the program dates?",
  "conversationId": "conv_123",
  "history": []
}
```

**Response:**
```json
{
  "message": "We have two 5-week blocks...",
  "showLeadForm": false
}
```

### POST /api/leads

Submit a lead for registration.

**Request:**
```json
{
  "name": "John Smith",
  "email": "john@example.com",
  "block": "block1",
  "conversationId": "conv_123",
  "messages": []
}
```

**Response:**
```json
{
  "success": true,
  "leadId": "uuid-here"
}
```

## Costs

- **OpenAI API:** ~$5/month (using GPT-4o-mini)
- **Supabase:** Free tier (up to 500MB database)
- **Resend:** Free tier (100 emails/day)
- **Vercel:** Free tier (sufficient for this use case)

## License

Private - Golf AI Agency
