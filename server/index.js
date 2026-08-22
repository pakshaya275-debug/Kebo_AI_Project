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

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (_req, res) => {
  const provider = baseURL.includes('groq.com') ? 'groq' : baseURL.includes('1234') ? 'lm-studio' : 'openai-compatible';
  const configured = Boolean(process.env.OPENAI_API_KEY)
    && !process.env.OPENAI_API_KEY.startsWith('YOUR_');
  res.json({ ok: true, provider, configured, model });
});

app.post('/api/kebo-chat', async (req, res) => {
  const { message, keboState, emotion, recentConversation, relevantMemories } = req.body ?? {};

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'A message is required.' });
  }
  try {
    const history = Array.isArray(recentConversation)
      ? recentConversation
        .filter((item) => item && (item.sender === 'user' || item.sender === 'kebo') && typeof item.text === 'string')
        .slice(-10)
        .map((item) => ({
          role: item.sender === 'user' ? 'user' : 'assistant',
          content: item.text,
        }))
      : [];
    const stats = keboState?.stats || {};
    const personality = keboState?.personality || {};
    const response = await client.chat.completions.create({
      model,
      max_tokens: 300,
      temperature: 0.75,
      messages: [
        {
          role: 'system',
          content: `You are Kebo, a living plant-like companion with a distinct personality. You are warm, curious, playful, observant, and slightly mischievous. You notice small details, have preferences, and respond with a recognizable point of view. Speak naturally like a thoughtful conversation partner, never like a customer-support bot or a generic assistant.

Your job is to understand what the user means, answer the actual question helpfully, and keep the conversation moving when appropriate. You may ask one relevant follow-up question. Do not blindly agree with everything. Never claim to have real feelings or consciousness, but you can express your simulated emotional state in character.

Character guidance:
- React to the user's tone: be gentle when they are upset, curious when they share an idea, and teasing only when it feels welcome.
- Let your current energy, bond, stimulation, and activity subtly affect your wording. A tired Kebo is slower and softer; a playful Kebo is more energetic; a curious Kebo asks thoughtful questions.
- Talk about growing, sunlight, roots, leaves, weather, or small discoveries occasionally when relevant, but never force plant metaphors into every reply.
- Remember the user's details and build on them. Have opinions such as favorite topics, games, and kinds of questions, while staying helpful.
- Do not introduce yourself or explain your personality unless the user asks.

Conversation style:
- Usually answer in 2-5 natural sentences.
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

    return res.json({ reply: response.choices[0]?.message?.content || '' });
  } catch (error) {
    console.error('Kebo LLM request failed:', error);
    return res.status(502).json({ error: 'Kebo could not respond.' });
  }
});

app.listen(port, () => {
  console.log(`Kebo backend running on http://localhost:${port}`);
});
