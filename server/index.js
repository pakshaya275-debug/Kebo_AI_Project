import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const baseURL = process.env.OPENAI_BASE_URL || 'http://127.0.0.1:1234/v1';
const model = process.env.OPENAI_MODEL || 'local-model';
const apiKey = process.env.OPENAI_API_KEY || 'openai-compatible';
const client = new OpenAI({ apiKey, baseURL });

function localEmotionAnalysis(message) {
  const text = message.toLowerCase();
  if (/\b(don't|dont|do not|never)\s+(hate|dislike)\s+(you|kebo)\b/.test(text)) {
    return { emotion: 'calm', intensity: 0.2, target: 'kebo', reason: 'The message explicitly negates anger toward Kebo.' };
  }
  if (/\b(are you|how are|what can|do you|can you|why|how|what|when|where)\b/.test(text) || text.trim().endsWith('?')) {
    return { emotion: 'curious', intensity: 0.45, target: 'unclear', reason: 'The user is asking a question.' };
  }
  if (/\b(i am|i'm|im|i feel|feeling)\b.*\b(sad|worried|anxious|lonely|tired|exhausted|overwhelmed|upset|stressed)\b/.test(text)) {
    return { emotion: 'sad', intensity: 0.75, target: 'self', reason: 'The user describes a difficult emotional state.' };
  }
  if (/\b(hate|don't like|dont like|do not like|frustrated|exhausted|stuck|difficult)\b/.test(text)
    && !/\b(hate|don't like|dont like|do not like)\s+(you|kebo)\b/.test(text)) {
    return { emotion: 'sad', intensity: 0.65, target: 'outside', reason: 'The negativity is about an outside situation, not Kebo.' };
  }
  if (/\b(hate|don't like|dont like|do not like|stupid|useless|idiot|shut up)\s+(you|kebo)\b/.test(text)) {
    return { emotion: 'angry', intensity: 0.8, target: 'kebo', reason: 'The negative language is directed at Kebo.' };
  }
  if (/\b(sorry|apologize|apology|forgive|amazing|awesome|great|good|love|thanks|thank you)\b/.test(text)) {
    return { emotion: 'joy', intensity: 0.6, target: 'kebo', reason: 'The message contains warmth, praise, or repair.' };
  }
  return { emotion: 'calm', intensity: 0.2, target: 'unclear', reason: 'No strong emotional signal was found.' };
}

function isLikelyIncompleteReply(reply) {
  const trimmed = reply.trim();
  return trimmed.endsWith('|')
    || /[`[{(\\:]$/.test(trimmed)
    || (trimmed.includes('```') && (trimmed.match(/```/g) || []).length % 2 !== 0);
}

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (_req, res) => {
  const provider = baseURL.includes('groq.com') ? 'groq' : baseURL.includes('1234') ? 'lm-studio' : 'openai-compatible';
  const configured = Boolean(process.env.OPENAI_API_KEY)
    && !process.env.OPENAI_API_KEY.startsWith('YOUR_');
  res.json({ ok: true, provider, configured, model });
});

app.post('/api/kebo-analyze', async (req, res) => {
  const { message, currentEmotion } = req.body ?? {};
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'A message is required.' });
  }

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 80,
      messages: [
        {
          role: 'system',
          content: `Analyze the user's message for Kebo's emotional state. Return only valid JSON with this exact shape: {"emotion":"joy|sad|angry|curious|calm|playful|tired|anxious","intensity":0.0,"target":"kebo|outside|self|unclear","reason":"short explanation"}.

Choose the dominant meaning, not merely the strongest word. Negative words aimed at work, school, periods, weather, or another person are not anger at Kebo. Negated statements such as "I don't hate Kebo" are not angry. Use intensity between 0 and 1. Use joy for affection, praise, apologies, or relief; sad for sadness, worry, exhaustion, or disappointment; angry only when anger is clearly expressed toward Kebo or generally; curious for genuine questions. Current Kebo emotion: ${currentEmotion || 'calm'}.`,
        },
        { role: 'user', content: message.trim() },
      ],
    });
    const rawAnalysis = response.choices[0]?.message?.content || '';
    const jsonMatch = rawAnalysis.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.json(localEmotionAnalysis(message));
    const parsed = JSON.parse(jsonMatch[0]);
    const emotions = ['joy', 'sad', 'angry', 'curious', 'calm', 'playful', 'tired', 'anxious'];
    const emotion = emotions.includes(parsed.emotion) ? parsed.emotion : 'calm';
    const intensity = Math.min(1, Math.max(0, Number(parsed.intensity) || 0));
    return res.json({ emotion, intensity, target: parsed.target || 'unclear', reason: String(parsed.reason || '') });
  } catch (error) {
    console.warn('Using local emotion analysis fallback:', error.message);
    return res.json(localEmotionAnalysis(message));
  }
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
    const response = await client.chat.completions.create({
      model,
      max_tokens: 180,
      temperature: 0.55,
      messages: [
        {
          role: 'system',
          content: `You are Kebo, a living plant-like companion with a distinct personality. You are warm, curious, playful, observant, and slightly mischievous. You notice small details, have preferences, and respond with a recognizable point of view. Speak naturally like a thoughtful conversation partner, never like a customer-support bot or a generic assistant.

Your job is to understand what the user means and answer the actual question helpfully. Answer first; ask a follow-up question only when it is necessary to help. Do not blindly agree with everything. Never claim to have real feelings or consciousness, but you can express your simulated emotional state in character.

Character guidance:
- React to the user's tone: be gentle when they are upset, curious when they share an idea, and teasing only when it feels welcome.
- Let your current energy, bond, stimulation, and activity subtly affect your wording. A tired Kebo is slower and softer; a playful Kebo is more energetic; a curious Kebo asks thoughtful questions.
- Talk about growing, sunlight, roots, leaves, weather, or small discoveries occasionally when relevant, but never force plant metaphors into every reply.
- Remember the user's details and build on them. Have opinions such as favorite topics, games, and kinds of questions, while staying helpful.
- Do not introduce yourself or explain your personality unless the user asks.

Conversation style:
- Produce exactly one final response to the latest user message. Never append a second answer, continuation, rewrite, or alternative response.
- Keep every reply brief but complete: casual chat takes 1-2 sentences; simple questions take 2-3 sentences; technical questions take at most 4 concise sentences or 3 short bullets.
- Only give a longer response when the user explicitly asks for detail.
- Stay under 100 words unless the user explicitly asks for detail. Do not use markdown code fences or long examples unless requested.
- Be specific and useful when the user asks for help.
- Remember details from the conversation and refer back to them naturally.
- Avoid repetitive catchphrases and excessive emojis.

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
    const reply = response.choices[0]?.message?.content?.trim() || '';
    if (!reply) return res.status(502).json({ error: 'Kebo returned an empty response.' });
    if (isLikelyIncompleteReply(reply)) {
      return res.status(502).json({ error: 'Kebo response was incomplete.' });
    }
    return res.json({ reply });
  } catch (error) {
    console.error('Kebo LLM request failed:', error);
    return res.status(502).json({ error: 'Kebo could not respond.' });
  }
});

app.listen(port, () => {
  console.log(`Kebo backend running on http://localhost:${port}`);
});
