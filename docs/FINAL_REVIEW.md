# Kebo Finalization Review

## Purpose
Kebo is a plant-like AI companion prototype designed to maintain conversational continuity through a simulated emotional state, a recognizable companion personality, and persistent structured memories. Its emotional variables are computational signals, not claims of consciousness.

## Emotion model and companion behavior
Kebo keeps the user's inferred emotional context separate from its own simulated visible emotion. Clear distress signals (for example, loneliness, social exhaustion, or feeling excluded) should usually make Kebo's visible expression calm and attentive rather than copying the user's sadness or anger. Anger explicitly directed at Kebo remains a separate case. The language model is used for conversational language; the frontend's deterministic state engine remains authoritative for simulated vitals. Emotion labels are heuristic estimates, not clinical assessments or evidence of consciousness.

## Voice interaction and known limits
Voice input is push-to-talk: the browser records audio, the backend transcribes it, the transcript enters the same chat pipeline as typed text, and browser speech synthesis reads Kebo's reply aloud. This is not real-time speech-to-speech. Microphone permission, browser recording support, network availability, transcription-provider availability, and installed browser voices can all affect the experience. On errors, the UI should return to a usable non-listening state and keep text chat available. Voice reliability must be verified in the target browser before the demonstration.

## Runtime architecture
1. The React/TypeScript frontend accepts typed messages or push-to-talk audio.
2. The emotion-analysis endpoint applies a deterministic local classifier. It does not need a provider LLM call.
3. The frontend state engine updates Kebo's vitals and dominant simulated emotion.
4. Relevant structured memories and recent conversation context are sent to the chat endpoint.
5. The backend makes one provider chat-completion request for the final reply and memory candidates.
6. The frontend validates the response, updates the conversation, and stores candidate memories in localStorage and, when configured, Supabase.
7. Voice input uses backend transcription; spoken output uses browser speech synthesis where supported.

## Provider response contract
The chat endpoint expects a JSON object containing:
- `reply`: a non-empty conversational string.
- `extracted_memories`: an array of concise, explicitly stated, persistent user facts/preferences/goals/events. It should not contain transient moods, secrets, guesses, or information invented by the assistant.

The backend validates the shape and length of the fields before returning a normalized response. The frontend treats missing memory candidates as an empty list. The frontend state engine remains authoritative for vital updates; the LLM does not directly overwrite numeric vitals.

## Memory behavior
- Current storage uses structured memory records and relevance scoring, not embeddings or vector search.
- Candidate extraction combines existing local extraction with structured candidates returned by the chat model.
- Exact duplicates are not added; selected profile fields and broad preference categories can be replaced by newer values.
- localStorage is the local fallback. Supabase persistence depends on correct project configuration and database access policies.
- The current prototype uses a browser/device identifier. It is not a substitute for authenticated multi-user identity isolation.

## Voice behavior
- Input: MediaRecorder audio capture, then the backend transcription endpoint.
- Output: browser `speechSynthesis`, when available.
- Microphone and speech-synthesis failures should leave text chat usable. This is not a real-time speech-to-speech LLM.

## Deployment configuration
Backend (Render):
- `OPENAI_API_KEY`: active provider key; never place it in frontend environment variables.
- `OPENAI_BASE_URL`: provider-compatible API base, for Groq commonly `https://api.groq.com/openai/v1`.
- `OPENAI_MODEL`: a model available to the configured provider.
- `CLIENT_ORIGIN`: comma-separated production frontend origin(s), if needed.
- `TRANSCRIPTION_MODEL`: a transcription model supported by the configured provider.

Frontend (Vercel):
- `VITE_KEBO_API_BASE_URL`: backend base URL.
- `VITE_KEBO_API_URL`: chat endpoint URL or supported base/path configuration.
- `VITE_KEBO_ANALYZE_URL`: emotion-analysis endpoint URL.
- `VITE_KEBO_TRANSCRIBE_URL`: transcription endpoint URL.
- Supabase public URL/anon key only when the database and row-level policies are configured correctly.

Do not paste API keys into source control, screenshots, or academic documents. After changing deployment variables, redeploy the affected service.

## Final smoke-test checklist
- [ ] `GET /api/health` returns `ok: true`, the expected provider/model, and `configured: true`.
- [ ] A normal greeting returns a natural Kebo reply.
- [ ] A technical question receives a useful answer while retaining a subtle companion voice.
- [ ] A message about sadness/frustration produces a supportive response rather than blindly copying the user's emotion.
- [ ] Anger directed at Kebo differs from frustration directed at the user's own situation.
- [ ] A clearly stated stable preference appears in Memory after the reply.
- [ ] Repeating or updating a memory does not create needless duplicates.
- [ ] Reloading the page preserves available local/Supabase memories.
- [ ] Voice transcription works in a supported browser, or displays a clear error while text chat remains usable.
- [ ] Browser speech synthesis works where available, and synthesis failure does not crash the application.
- [ ] Test the deployed Vercel-to-Render request in the browser Network tab and inspect Render logs if it fails.
- [ ] Run `npm run typecheck`, `npm run lint`, and `npm run build` before final submission.

## Known limitations to disclose
- Emotion is simulated by deterministic application logic; it is not consciousness.
- Current memory retrieval uses structured records and lexical relevance scoring, not vector embeddings.
- Current voice uses transcription plus browser speech synthesis, not a dedicated real-time voice model.
- The prototype's browser/device ID approach is demo-oriented; production multi-user use needs authentication, per-user isolation, and verified database policies.
- LLM output and availability depend on the configured external provider.
- The code changes should be validated against the actual deployed environment; a repository update alone does not prove the live deployment is healthy.
