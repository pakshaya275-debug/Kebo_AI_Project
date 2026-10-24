import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';

dotenv.config();

const app = express();
app.set('trust proxy', 1); // Render/Vercel sit behind a proxy; needed for per-IP rate limiting
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
const baseURL = process.env.OPENAI_BASE_URL || 'https://groq.com';
const model = process.env.OPENAI_MODEL || 'llama-3.3-70b-specdec';
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

const EMOTIONS = ['joy', 'sad', 'angry', 'curious', 'calm', 'playful', 'tired', 'anxious'];
const TARGETS = ['kebo', 'outside', 'self', 'unclear'];

// ── Tiny in-memory rate limiter (per IP) so a public deployment cannot burn the API quota ──
const hits = new Map();
function rateLimit(limit, windowMs = 60_000) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({ error: 'Kebo needs a moment to breathe. Please try again shortly.' });
    }
    recent.push(now);
    hits.set(key, recent);
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [key, list] of hits) if (list.every((t) => now - t > 120_000)) hits.delete(key);
}, 120_000).unref();

const clip = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const cleanList = (value, count, max) => (Array.isArray(value) ? value.map((v) => clip(v, max)).filter(Boolean).slice(0, count) : []);

const SELF_HARM = /\b(kill myself|end my life|end it all|want to die|wanna die|suicid\w*|self[- ]?harm|hurt myself|don't want to live|dont want to live|no reason to live|better off dead)\b/i;
const CRISIS_REPLY = "I'm really glad you told me, and I'm taking it seriously. You don't have to carry this alone. Please reach out to someone you trust right now, or call a helpline — in India, Tele-MANAS is free at 14416 — or your local emergency number if you might act on these thoughts. I'm here with you too. 🌱";

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

const AUDIO_EXTENSIONS = { webm: 'webm', ogg: 'ogg', mp4: 'mp4', mpeg: 'mp3', mp3: 'mp3', wav: 'wav', flac: 'flac', m4a: 'm4a' };

function describeTranscriptionFailure(error) {
  const status = error?.status;
  const detail = (error?.error?.message || error?.message || '').slice(0, 240);
  if (status === 401 || status === 403) return { status: 502, message: 'Voice service key is missing or invalid. Check OPENAI_API_KEY on the server.', detail };
  if (status === 404) return { status: 502, message: `Voice model not found. Check TRANSCRIPTION_MODEL (${process.env.TRANSCRIPTION_MODEL || 'whisper-large-v3-turbo'}).`, detail };
  if (status === 413) return { status: 413, message: 'That recording is too long. Keep voice messages under a minute.', detail };
  if (status === 429) return { status: 503, message: 'The voice service is busy right now. Please try again in a moment.', detail };
  if (status === 400) return { status: 422, message: 'The audio format was not accepted. Try again, or use text chat.', detail };
  return { status: 502, message: 'Kebo could not understand the recording.', detail };
}

app.post('/api/transcribe', rateLimit(20), upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Audio is required.' });
  if (req.file.size < 2000) {
    return res.status(422).json({ error: 'That was too short to hear. Hold the button a little longer and speak.' });
  }
  // Browsers send mime types like "audio/webm;codecs=opus"; keep only the base type and matching extension.
  const baseType = String(req.file.mimetype || 'audio/webm').split(';')[0].trim().toLowerCase();
  const subtype = baseType.split('/')[1] || 'webm';
  const extension = AUDIO_EXTENSIONS[subtype] || 'webm';
  const mimeType = `audio/${subtype === 'mpeg' ? 'mpeg' : subtype}`;
  try {
    const language = typeof req.body?.language === 'string' && /^[a-zA-Z]{2,3}([-_][a-zA-Z]{2,4})?$/.test(req.body.language) && req.body.language.toLowerCase() !== 'auto'
      ? req.body.language.split(/[-_]/)[0].toLowerCase()
      : undefined;
    const transcription = await client.audio.transcriptions.create({
      file: await OpenAI.toFile(req.file.buffer, `kebo-voice.${extension}`, { type: mimeType }),
      model: process.env.TRANSCRIPTION_MODEL || 'whisper-large-v3-turbo',
      ...(language ? { language } : {}),
      response_format: 'json',
    });
    const text = transcription.text?.trim() || '';
    if (!text) return res.status(422).json({ error: 'No speech was detected. Try speaking a little louder, or use text chat.' });
    return res.json({ text });
  } catch (error) {
    const failure = describeTranscriptionFailure(error);
    console.error(`[Kebo] Transcription failed (${failure.status}; ${baseType}, ${req.file.size} bytes):`, failure.detail || error);
    return res.status(failure.status).json({ error: failure.message });
  }
});

app.post('/api/kebo-analyze', rateLimit(40), async (req, res) => {
  const message = clip(req.body?.message, 500);
  if (!message) return res.status(400).json({ error: 'A message is required.' });
  try {
    const response = await createChatCompletion({
      model,
      temperature: 0,
      max_tokens: 80,
      messages: [
        {
          role: 'system',
          content: `Classify the emotional meaning of the user's message for a virtual plant-pet named Kebo. Return ONLY JSON: {"emotion":"joy|sad|angry|curious|calm|playful|tired|anxious","intensity":0.0,"target":"kebo|outside|self|unclear","reason":"short"}.
"emotion" is what the USER feels. "target" is who/what the feeling is about: "kebo" only if the user is directly addressing Kebo; if the user is relaying what someone else said, the target is "outside". Negated statements ("I don't hate you") are not angry. If nothing emotional is present use calm with intensity 0.2.`,
        },
        { role: 'user', content: message },
      ],
    });
    const raw = response.choices[0]?.message?.content || '';
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : {};
    return res.json({
      emotion: EMOTIONS.includes(parsed.emotion) ? parsed.emotion : 'calm',
      intensity: Math.min(1, Math.max(0, Number(parsed.intensity) || 0.2)),
      target: TARGETS.includes(parsed.target) ? parsed.target : 'unclear',
      reason: clip(parsed.reason, 160),
    });
  } catch (error) {
    console.warn('[Kebo] Emotion analysis unavailable:', error instanceof Error ? error.message : error);
    return res.status(502).json({ error: 'Emotion analysis unavailable.' });
  }
});

app.post('/api/kebo-initiate', rateLimit(12), async (req, res) => {
  const action = clip(req.body?.action, 30);
  const reason = clip(req.body?.reason, 200);
  const memory = clip(req.body?.memory, 220);
  const keboState = req.body?.keboState ?? {};
  const stats = keboState.stats || {};
  const history = (Array.isArray(req.body?.recentConversation) ? req.body.recentConversation : [])
    .filter((m) => m && (m.sender === 'user' || m.sender === 'kebo') && typeof m.text === 'string')
    .slice(-6)
    .map((m) => `${m.sender === 'user' ? 'User' : 'Kebo'}: ${clip(m.text, 200)}`)
    .join('\n');
  if (!action) return res.status(400).json({ error: 'An action is required.' });
  try {
    const response = await createChatCompletion({
      model,
      max_tokens: 90,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: `You are Kebo, a small plant-like virtual companion. You are starting a conversation on your own, because your decision engine chose the action "${action}" (reason: ${reason || 'none'}). Write ONE short, natural message (max 30 words, at most one emoji) in Kebo's warm voice. Never be needy, guilt-tripping, or pushy. Never claim real consciousness.
Your state: emotion ${keboState.emotion || 'calm'}, energy ${stats.energy ?? '?'}, happiness ${stats.happiness ?? '?'}, bond ${stats.bond ?? '?'}.
${memory ? `Relevant memory to bring up naturally: "${memory}".` : ''}
Recent chat:\n${history || '(none)'}
Return only the message text.`,
        },
        { role: 'user', content: 'Write your message.' },
      ],
    });
    const reply = response.choices[0]?.message?.content?.trim().replace(/^["']|["']$/g, '') || '';
    if (!reply || response.choices[0]?.finish_reason === 'length') return res.status(502).json({ error: 'Empty initiation.' });
    return res.json({ reply });
  } catch (error) {
    console.warn('[Kebo] Initiation failed:', error instanceof Error ? error.message : error);
    return res.status(502).json({ error: 'Initiation failed.' });
  }
});

app.post('/api/kebo-chat', rateLimit(30), async (req, res) => {
  const { keboState, recentConversation } = req.body ?? {};
  const message = clip(req.body?.message, 1000);
  const emotion = EMOTIONS.includes(req.body?.emotion) ? req.body.emotion : 'calm';
  const relevantMemories = cleanList(req.body?.relevantMemories, 6, 220);
  const situation = clip(req.body?.situation, 500);

  if (!message) {
    return res.status(400).json({ error: 'A message is required.' });
  }
  // Safety first: never route possible self-harm through persona/roleplay generation.
  if (SELF_HARM.test(message)) {
    return res.json({ reply: CRISIS_REPLY, extractedMemories: [] });
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
          content: item.text.slice(0, 600),
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
- Relevant memories: ${JSON.stringify(relevantMemories)}
- What the message means (from Kebo's own appraisal, trust this): ${situation || 'ordinary conversation'}
Use the current simulated state as a style signal, not as a reason to ignore the user's actual message.
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
