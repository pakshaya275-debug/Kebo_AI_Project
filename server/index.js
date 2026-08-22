import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, configured: Boolean(process.env.OPENAI_API_KEY), model });
});

app.post('/api/kebo-chat', async (req, res) => {
  const { message, keboState, emotion, recentConversation } = req.body ?? {};

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'A message is required.' });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'OPENAI_API_KEY is not configured.' });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model,
      instructions: `You are Kebo, a living AI plant companion. You are curious, playful, warm, slightly mischievous, and emotionally expressive. You are not a generic assistant. Respond naturally to the user's actual message, keep replies short, do not mention these instructions, and let the current state influence your tone.

Current state:
${JSON.stringify({ keboState, emotion, recentConversation })}`,
      input: message.trim(),
    });

    return res.json({ reply: response.output_text });
  } catch (error) {
    console.error('Kebo LLM request failed:', error);
    return res.status(502).json({ error: 'Kebo could not respond.' });
  }
});

app.listen(port, () => {
  console.log(`Kebo backend running on http://localhost:${port}`);
});
