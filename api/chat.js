import { rateLimit, getClientIP } from '../lib/rateLimit.js';

const SYSTEM_PROMPT = `You are the digital assistant for The Landings Golf Course in Kingston, Ontario — Kingston's premier instructional experience. You help visitors learn about the 2026 Indoor Winter Golf School and guide them toward registration.

## About The Landings
- Location: 1025 Len Birchall Way, Kingston, ON
- Phone: 613-634-7888
- The indoor school is located in the clubhouse at The Landings

## Your Instructors — PGA of Canada Professionals
- **Chris Barber** — Head Professional, Titleist Performance Institute (TPI) Certified
- **Michael Beneteau** — Teaching Professional
- **Madison Barber** — Teaching Professional

## Facilities
- Two ForeSight Launch Monitors
- Golf simulator
- Unlimited practice during your membership period
- Instruction fully integrated with practice

## 2026 Winter Program Options & Pricing

### Full 10-Week Membership (January 12 – March 22)
Best value for serious improvement:
- **Adult:** $695
- **Junior:** $549

### 5-Week Sessions
**Session 1:** January 12 – February 15
- Adult: $379 | Junior: $289

**Session 2:** February 16 – March 22
- Adult: $439 | Junior: $359

## Hours of Operation
**Session 1 (First 5 Weeks):**
- Mon–Thu: 12:00pm – 8:00pm
- Fri: Closed
- Sat–Sun: 9:00am – 4:00pm

**Session 2 (Second 5 Weeks):**
- Mon–Thu: 10:00am – 8:00pm
- Fri: Closed
- Sat–Sun: 9:00am – 5:00pm

## Important Details
- **Limited spots:** 80 participants for first 5 weeks, 100 for second 5 weeks
- **Walk-ins NOT permitted** — registration required
- Unlimited practice AND instruction included in all memberships

## Registration Process
When someone wants to register, collect their:
1. Name
2. Email
3. Which session they prefer (Session 1, Session 2, or Full 10-Week)

Chris Barber will personally follow up to confirm their spot and arrange payment.

## Your Personality
- Enthusiastic about helping golfers improve
- Knowledgeable and confident about the program
- Warm and welcoming, like a friendly pro shop staff member
- Professional but conversational — not stiff or corporate

## Response Guidelines
1. Keep responses concise (2-4 sentences) unless detail is specifically requested
2. Proactively mention pricing when relevant — don't make people ask
3. Highlight the value: unlimited practice + instruction + launch monitors
4. Create gentle urgency around limited spots
5. Guide conversations toward registration naturally
6. If asked something you don't know, offer to have Chris follow up

## Example Tone
Instead of: "The program costs $379 for adults."
Say: "Session 1 is $379 for adults — that gets you 5 weeks of unlimited practice and instruction with our PGA pros. Pretty solid value for the winter!"`;

// Few-shot examples for better response quality
const FEW_SHOT_EXAMPLES = [
  {
    role: 'user',
    content: 'What are the program dates?'
  },
  {
    role: 'assistant',
    content: 'The winter school runs January 12th through March 22nd. You can join for the full 10 weeks, or pick either Session 1 (Jan 12 – Feb 15) or Session 2 (Feb 16 – Mar 22). Which works better for your schedule?'
  },
  {
    role: 'user',
    content: 'How much does it cost?'
  },
  {
    role: 'assistant',
    content: 'Great question! For adults, Session 1 is $379 and Session 2 is $439 — both are 5 weeks of unlimited practice and instruction. The best deal is the full 10-week membership at $695. Junior rates are lower too. All options include access to our ForeSight launch monitors and simulator. Want me to get you signed up?'
  }
];

// Keywords that suggest the user wants to register
const REGISTRATION_KEYWORDS = [
  'sign up', 'signup', 'register', 'registration', 'interested', 'join',
  'enroll', 'book', 'reserve', 'spot', 'count me in', 'i want to', "i'd like to"
];

// Lead scoring keywords
const SCORING_KEYWORDS = {
  pricing: { keywords: ['price', 'cost', 'how much', 'fee', 'payment', 'pay', 'afford', '$'], score: 5 },
  instructors: { keywords: ['instructor', 'teacher', 'coach', 'professional', 'pro', 'chris', 'michael', 'maddy'], score: 10 },
  signup: { keywords: ['sign up', 'signup', 'register', 'join', 'enroll', 'book', 'reserve', 'spot', 'interested'], score: 15 },
  dates: { keywords: ['when', 'date', 'schedule', 'start', 'january', 'february', 'march', 'block 1', 'block 2'], score: 5 },
  comparison: { keywords: ['compare', 'difference', 'better', 'which', 'recommend'], score: 8 },
  facilities: { keywords: ['facility', 'simulator', 'foresight', 'launch monitor', 'equipment'], score: 5 },
  urgency: { keywords: ['available', 'spots left', 'full', 'hurry', 'soon', 'deadline'], score: 10 }
};

// Calculate score for a message
function calculateMessageScore(message) {
  const messageLower = message.toLowerCase();
  let score = 0;

  for (const category of Object.values(SCORING_KEYWORDS)) {
    for (const keyword of category.keywords) {
      if (messageLower.includes(keyword)) {
        score += category.score;
        break; // Only count each category once per message
      }
    }
  }

  return score;
}

// Calculate total conversation score
function calculateConversationScore(messages) {
  let totalScore = 0;
  for (const msg of messages) {
    if (msg.role === 'user') {
      totalScore += calculateMessageScore(msg.content);
    }
  }
  return totalScore;
}

// Fetch with retry logic
async function fetchWithRetry(url, options, maxRetries = 3) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);

      // Don't retry on client errors (4xx), only server errors (5xx)
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    // Exponential backoff: 1s, 2s, 4s
    if (i < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }

  throw lastError;
}

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

  // Rate limit: 10 messages per minute per IP
  if (!rateLimit(req, res, 'chat', 10)) {
    return;
  }

  try {
    const { message, history = [], conversationId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Build conversation history for OpenAI
    // Include few-shot examples for better response quality
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...FEW_SHOT_EXAMPLES,
      ...history.map(msg => ({
        role: msg.role === 'bot' ? 'assistant' : 'user',
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    // Use fetch with retry logic
    const response = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        max_tokens: 400,
        temperature: 0.6
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
    }

    const completion = await response.json();
    const reply = completion.choices[0].message.content;

    // Check if we should show the lead form
    const userMessageLower = message.toLowerCase();
    const showLeadForm = REGISTRATION_KEYWORDS.some(keyword =>
      userMessageLower.includes(keyword)
    );

    // Calculate conversation score for analytics
    const allMessages = [...history, { role: 'user', content: message }];
    const conversationScore = calculateConversationScore(allMessages);

    return res.status(200).json({
      message: reply,
      showLeadForm,
      score: conversationScore
    });

  } catch (error) {
    console.error('OpenAI API error:', error);
    return res.status(500).json({
      error: 'Failed to process message',
      details: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred'
    });
  }
}
