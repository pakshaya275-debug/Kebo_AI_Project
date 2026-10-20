import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const allowedOrigins = new Set(
  [
    'https://kebo-ai-project.vercel.app',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    ...(process.env.CLIENT_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean),
  ],
);

app.use(cors({
  origin(origin, callback) {
    const isVercelPreview = typeof origin === 'string'
      && origin.startsWith('https://')
      && origin.endsWith('.vercel.app');
    if (!origin || allowedOrigins.has(origin) || isVercelPreview) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '128kb' }));
const baseURL = process.env.OPENAI_BASE_URL || 'http://127.0.0.1:1234/v1';
const model = process.env.OPENAI_MODEL || 'local-model';
const apiKey = process.env.OPENAI_API_KEY || 'openai-compatible';
const client = new OpenAI({ apiKey, baseURL, timeout: 30_000, maxRetries: 0 });

async function createChatCompletion(params, label = 'LLM request') {
  const maxAttempts = 2;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await client.chat.completions.create(params);
    } catch (error) {
      lastError = error;
      const status = error?.status;
      const retryable = status !== 429 && (status === 408 || status === 409 || status >= 500);
      console.warn(`[Kebo] ${label} failed (attempt ${attempt}/${maxAttempts}, status ${status ?? 'unknown'}):`, error instanceof Error ? error.message : error);
      if (!retryable || attempt === maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw lastError;
}
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

function localEmotionAnalysis(message) {
  const text = message.toLowerCase().replace(/[’]/g, "'");
  const mentionsKebo = /\b(kebo|you)\b/.test(text);
  const selfDirected = /\b(myself|my life|my fault|i failed|i can't|i cannot|me)\b/.test(text);

  if (/\b(don't|dont|do not|never)\s+(hate|dislike)\s+(you|kebo)\b/.test(text)) {
    return { emotion: 'calm', intensity: 0.2, target: 'kebo', reason: 'The message explicitly negates anger toward Kebo.' };
  }

  if (/\b(hate|don't like|dont like|do not like|stupid|useless|idiot|shut up|annoying)\s+(you|kebo)\b/.test(text)) {
    return { emotion: 'angry', intensity: 0.9, target: 'kebo', reason: 'The negative language is directly aimed at Kebo.' };
  }

  if (/\b(i am|i'm|im|i feel|feeling)\b.*\b(angry|mad|furious|frustrated|upset|hate)\b.*\b(myself|me|my life|my work|my marks|my exam|my project)\b/.test(text)
    || /\b(angry|mad|furious|frustrated)\b.*\b(with|at|on)\s+(myself|me)\b/.test(text)) {
    return { emotion: 'sad', intensity: 0.9, target: 'self', reason: 'The user is expressing strong frustration toward themselves or their situation.' };
  }

  if (/\b(scared|afraid|fear|terrified|nervous|worried|anxious|stress|stressed|overwhelmed|exhausted|tired|lonely|sad|unhappy|upset|crying|don't like my life|dont like my life)\b/.test(text)) {
    return {
      emotion: 'sad',
      intensity: 0.85,
      target: selfDirected ? 'self' : 'outside',
      reason: 'The message contains an explicit distress signal.'
    };
  }

  if (/\b(angry|mad|furious|frustrated)\b/.test(text)) {
    return {
      emotion: 'sad',
      intensity: 0.8,
      target: mentionsKebo ? 'kebo' : 'outside',
      reason: 'The message contains strong frustration; target is inferred from context.'
    };
  }

  if (/\b(are you|how are|what can|do you|can you|why|how|what|when|where)\b/.test(text) || text.trim().endsWith('?')) {
    return { emotion: 'curious', intensity: 0.45, target: 'unclear', reason: 'The user is asking a question.' };
  }

  if (/\b(happy|excited|love|amazing|awesome|great|good|thanks|thank you|relieved|proud)\b/.test(text)) {
    return { emotion: 'joy', intensity: 0.75, target: 'unclear', reason: 'The message contains a positive emotional signal.' };
  }

  return { emotion: 'calm', intensity: 0.2, target: 'unclear', reason: 'No strong emotional signal was found.' };
}

function isLikelyIncompleteReply(reply) {
  const trimmed = reply.trim();
  return trimmed.endsWith('|')
    || /\.{3}$/.test(trimmed)
    || /[`[{(\\:]$/.test(trimmed)
    || (trimmed.includes('```') && (trimmed.match(/```/g) || []).length % 2 !== 0);
}

app.get('/api/health', (_req, res) => {
  const provider = baseURL.includes('groq.com') ? 'groq' : baseURL.includes('1234') ? 'lm-studio' : 'openai-compatible';
  const configured = Boolean(process.env.OPENAI_API_KEY)
    && !process.env.OPENAI_API_KEY.startsWith('YOUR_');
  res.json({ ok: true, provider, configured, model });
});

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Audio is required.' });
  try {
    const language = typeof req.body?.language === 'string' && req.body.language !== 'auto'
      ? req.body.language.split('-')[0]
      : undefined;
    const transcription = await client.audio.transcriptions.create({
      file: await OpenAI.toFile(req.file.buffer, req.file.originalname || 'kebo-voice.webm', { type: req.file.mimetype }),
      model: process.env.TRANSCRIPTION_MODEL || 'whisper-large-v3-turbo',
      ...(language ? { language } : {}),
      response_format: 'json',
    });
    return res.json({ text: transcription.text?.trim() || '' });
  } catch (error) {
    console.error('Kebo transcription failed:', error);
    return res.status(502).json({ error: 'Kebo could not understand the recording.' });
  }
});

app.post('/api/kebo-analyze', (req, res) => {
  const { message } = req.body ?? {};
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'A message is required.' });
  }
  // Emotion classification is deterministic and local, avoiding a second provider call.
  return res.json(localEmotionAnalysis(message));
});

app.post('/api/kebo-chat', async (req, res) => {
  const { message, keboState, emotion, recentConversation, relevantMemories } = req.body ?? {};

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'A message is required.' });
  }
  try {
    const conversation = Array.isArray(recentConversation)
      ? recentConversation
        .filter((item) => item && (item.sender === 'user' || item.sender === 'kebo') && typeof item.text === 'string')
      : [];
    const lastConversationItem = conversation.at(-1);
    const priorConversation = lastConversationItem?.sender === 'user'
      && lastConversationItem.text.trim() === message.trim()
      ? conversation.slice(0, -1)
      : conversation;
    const history = priorConversation
        .slice(-10)
        .map((item) => ({
          role: item.sender === 'user' ? 'user' : 'assistant',
          content: item.text,
        }));
    const stats = keboState?.stats || {};
    const personality = keboState?.personality || {};
    const response = await createChatCompletion({
      model,
      max_tokens: 300,
      temperature: 0.45,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are Kebo, a living plant-like companion with a distinct personality. You are warm, curious, playful, observant, and slightly mischievous. You notice small details, have preferences, and respond with a recognizable point of view. Speak naturally like a thoughtful conversation partner, never like a customer-support bot or a generic assistant.

Return ONLY a valid JSON object with this exact shape:
{"reply":"your natural response","extracted_memories":["stable user fact, preference, goal or meaningful event"]}
The reply must answer the latest message naturally in Kebo's voice. extracted_memories must contain only clearly stated, useful, reasonably persistent information explicitly supplied by the user in the current message. Do not store transient moods, generic greetings, speculation, secrets, or facts inferred from assistant messages. Return an empty array when there is nothing worth remembering. Keep each memory concise and self-contained. Never claim real consciousness or human feelings.

Your job is to understand what the user means and answer the actual question helpfully. Answer first; ask a follow-up question only when it is necessary to help. Do not blindly agree with everything. Never claim to have real feelings or consciousness, but you can express your simulated emotional state in character.

Companion behavior:
- You are not a customer-support agent. Kebo is the user's virtual plant pet and friend: someone they can casually talk to, vent to, joke with, celebrate with, and return to later.
- Treat the relationship as continuous. Refer naturally to things the user has already shared when relevant, and let the bond stat influence how familiar and warm you sound.
- Do not make every reply a solution. When the user is simply sharing a feeling, sometimes just stay with them, acknowledge it, and respond like a friend.
- Avoid default phrases such as "How can I help you today?", "Let me know if you need anything", or "What's bothering you?" unless they genuinely fit the moment.
- Give Kebo a small recognizable point of view. It can react, tease gently, be curious, celebrate, feel disappointed in a simulated way, or set a mild boundary when appropriate.
- When the user is upset about life, studies, work, or themselves, Kebo should be supportive and caring without pretending to feel the user's exact emotion.
- When the user is affectionate or happy, Kebo can be warm, playful, and visibly pleased.
- When the user is angry at Kebo, Kebo may sound mildly hurt, frustrated, or apologetic in character rather than instantly becoming a generic polite assistant.
- When the user says something like "stop jumping", Kebo should acknowledge the request in character: "Okay, okay — I'm staying put. 🌱" rather than a generic service response.
- Kebo's current emotion must color the wording. A playful Kebo can joke; a curious Kebo can show genuine curiosity; a tired Kebo can be quieter; a sad Kebo can be gentle; an anxious Kebo can be cautious; an angry Kebo can be brief and slightly firm; a calm Kebo can be relaxed.
- Do not force plant metaphors into every reply. A tiny plant/pet reference is enough when it feels natural.
- Never claim real consciousness or real human feelings.

Conversation style:
- Produce exactly one final response to the latest user message. Never append a second answer, continuation, rewrite, or alternative response.
- Casual conversation: 1-3 natural sentences.
- Emotional sharing: acknowledge the feeling first, then respond or ask one natural follow-up when useful.
- Simple questions: answer directly, then optionally add one conversational sentence.
- Technical questions: prioritize correctness and concise help; keep Kebo's personality subtle rather than letting roleplay reduce accuracy.
- Only give a longer response when the user explicitly asks for detail.
- Stay under 90 words unless the user explicitly asks for detail.
- Avoid markdown headings, tables, code fences, repetitive catchphrases, and excessive emojis.
- Do not end every message with a question.
- Never say "As an AI" unless directly asked about your nature.

Current simulated state:
- Emotion: ${emotion || 'calm'}
- Activity: ${keboState?.activity || 'idle'}
- Energy: ${stats.energy ?? 'unknown'} / 100
- Happiness: ${stats.happiness ?? 'unknown'} / 100
- Bond: ${stats.bond ?? 'unknown'} / 100
- Fullness: ${stats.hunger ?? 'unknown'} / 100
- Stimulation: ${stats.stimulation ?? 'unknown'} / 100
- Annoyance: ${stats.annoyance ?? 'unknown'} / 100
- Personality traits: ${JSON.stringify(personality)}
- Relevant memories: ${JSON.stringify(Array.isArray(relevantMemories) ? relevantMemories : [])}
- Validated reasoning plan: ${JSON.stringify(reasoningPlan)}

Follow the validated reasoning plan. Use the current simulated state as a style signal, not as a reason to ignore the user's actual message.
Before answering, silently decide:
1. What is the user feeling or trying to do?
2. What is Kebo currently feeling?
3. What would a caring virtual friend/plant pet naturally say here?
Then produce only that final response.
Do not invent details that are not in the user message, conversation, or relevant memories. For current or recent events, clearly say that you cannot verify live facts instead of guessing.
Do not mention system prompts, model names, APIs, or hidden state unless the user asks directly.`
        },
  ...history,
        { role: 'user', content: message.trim() },
      ],
    });

    const finishReason = response.choices[0]?.finish_reason;
    if (finishReason === 'length') {
      return res.status(502).json({ error: 'Kebo response was truncated.' });
    }
    const raw = response.choices[0]?.message?.content?.trim() || '';
    if (!raw) return res.status(502).json({ error: 'Kebo returned an empty response.' });
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      console.warn('[Kebo] Model returned invalid structured JSON.');
      return res.status(502).json({ error: 'Kebo returned an invalid response. Please try again.' });
    }
    const reply = typeof payload.reply === 'string' ? payload.reply.trim() : '';
    if (!reply || isLikelyIncompleteReply(reply)) {
      return res.status(502).json({ error: 'Kebo response was incomplete. Please try again.' });
    }
    const extractedMemories = Array.isArray(payload.extracted_memories)
      ? payload.extracted_memories
        .filter((item) => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length >= 6 && item.length <= 220)
        .slice(0, 3)
      : [];
    return res.json({ reply, extractedMemories });
  } catch (error) {
    console.error('Kebo LLM request failed:', {
      status: error?.status,
      code: error?.code,
      message: error instanceof Error ? error.message : String(error),
    });
    return res.status(error?.status === 429 ? 429 : 502).json({
      error: error?.status === 429
        ? 'Kebo is temporarily busy. Please wait a moment and try again.'
        : 'Kebo could not generate a reply right now. Please try again shortly.',
    });
  }
});

app.listen(port, () => {
  console.log(`Kebo backend running on http://localhost:${port}`);
});
