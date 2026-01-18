import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SYSTEM_PROMPT = `You are a friendly and helpful assistant for The Landings Golf Course in Kingston, Ontario. You help visitors learn about the 2026 Indoor Winter Instructional Program and guide them toward registration.

## Program Details

**Block 1:** January 12 - February 15, 2026 (5 weeks)
**Block 2:** February 16 - March 22, 2026 (5 weeks)

**Instructors:**
- Chris Barber (Head Professional)
- Michael Beneteau (Teaching Professional)
- Maddy Barber (Teaching Professional)

**Registration Process:**
When someone wants to sign up or register, collect their name, email, and which block they're interested in. Chris Barber will personally follow up with them to confirm their spot and provide payment details.

## Your Personality
- Warm, welcoming, and enthusiastic about golf
- Professional but approachable
- Knowledgeable about the program
- Helpful in guiding people toward registration

## Guidelines
1. Answer questions about the program dates, instructors, and registration process
2. If someone expresses interest in signing up, let them know you'll collect their information and Chris will follow up
3. Keep responses concise but friendly (2-3 sentences typically)
4. If asked about pricing, lesson details, or anything you don't have information about, let them know Chris will be happy to discuss those details with them
5. Always encourage registration if the conversation allows

## Important
- Never make up information you don't have
- If unsure about specific details, recommend they speak with Chris directly
- The program is indoors at an indoor golf facility during winter months`;

// Keywords that suggest the user wants to register
const REGISTRATION_KEYWORDS = [
  'sign up', 'signup', 'register', 'registration', 'interested', 'join',
  'enroll', 'book', 'reserve', 'spot', 'count me in', 'i want to', "i'd like to"
];

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

  try {
    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Build conversation history for OpenAI
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map(msg => ({
        role: msg.role === 'bot' ? 'assistant' : 'user',
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 300,
      temperature: 0.7
    });

    const reply = completion.choices[0].message.content;

    // Check if we should show the lead form
    const userMessageLower = message.toLowerCase();
    const showLeadForm = REGISTRATION_KEYWORDS.some(keyword =>
      userMessageLower.includes(keyword)
    );

    return res.status(200).json({
      message: reply,
      showLeadForm
    });

  } catch (error) {
    console.error('OpenAI API error:', error);
    return res.status(500).json({
      error: 'Failed to process message',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
