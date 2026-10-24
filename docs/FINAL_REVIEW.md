# Kebo Finalization Review

## Purpose
Kebo is a plant-like AI companion prototype designed to maintain conversational continuity through a simulated emotional state, a recognizable companion personality, and persistent structured memories. Its emotional variables are computational signals, not claims of consciousness.

## Emotion model and companion behavior
Kebo keeps the user's inferred emotional context separate from its own simulated emotion. A rule-based **appraisal** step (`src/lib/appraisal.ts`) classifies what a message *means* for Kebo: a direct insult, someone else's insult relayed by the user, praise, apology, distress, a request for quiet, care, or a safety concern. It handles negation ("you're not ugly") and relayed speech ("my brother said…"). If the rules are unsure, the backend LLM is asked to refine the classification.

Clear user distress (sadness, stress, anger about something else) makes Kebo **calm and attentive** rather than copying the user's emotion; Kebo shows its own hurt or anger only when it is the target (or when an insult is relayed to it). The appraisal changes Kebo's **vitals** (energy, happiness, bond, fullness, stimulation, annoyance), scaled by a **seven-trait personality** (curiosity, playfulness, sensitivity, patience, sociability, courage, affection). The visible emotion is derived from the vitals, so moods build up and fade gradually: repeated insults accumulate into anger, a patient Kebo is slower to anger, a sensitive Kebo is hurt more. The language model writes the words; the frontend engine stays authoritative for vitals. Emotion labels are computational signals, not evidence of consciousness.

## Autonomous agent
`src/lib/agent.ts` implements a controlled loop (observe → remember → evaluate → decide → act). It scores WAIT, SEND_MESSAGE, ASK_QUESTION, REQUEST_ATTENTION, PLAY, EXPLORE, REST, REFERENCE_MEMORY and CHANGE_ACTIVITY from vitals, loneliness, personality and memories. Messages are gated by the autonomy setting (off/low/normal/high), cool-downs, a cap on unanswered messages, "be quiet" requests, and Kebo's own mood (an upset Kebo does not pester). Every action is recorded with its reason on the Activity page. Upcoming events the user mentioned (e.g. an exam) are followed up on once.

## Voice interaction and known limits
Voice input is push-to-talk: the browser records audio, the backend transcribes it, the transcript enters the same chat pipeline as typed text, and browser speech synthesis reads Kebo's reply aloud. This is not real-time speech-to-speech. Microphone permission, browser recording support, network availability, transcription-provider availability, and installed browser voices can all affect the experience. On errors, the UI should return to a usable non-listening state and keep text chat available. Voice reliability must be verified in the target browser before the demonstration.

## Runtime architecture
1. The React/TypeScript frontend accepts typed messages or push-to-talk audio.
2. The local appraisal engine classifies the message; `/api/kebo-analyze` (one small LLM call) is used only when the rules are unsure.
3. The state engine updates vitals, relationship counters and the simulated emotion.
4. Relevant memories, recent conversation and the appraisal's plain-English `situation` are sent to `/api/kebo-chat`.
5. The backend makes one chat-completion request for the reply and memory candidates. Possible self-harm messages bypass the persona and receive a fixed, caring reply with helpline guidance.
6. The frontend stores the conversation, memories (localStorage, and Supabase when configured) and activity log. State survives refresh.
7. A background agent loop may start conversations or ambient activities; `/api/kebo-initiate` phrases them. If the backend is unreachable, Kebo falls back to a built-in local brain so the app stays usable.
8. The backend rate-limits each endpoint per IP and caps input sizes.
9. Voice input uses backend transcription; spoken output uses browser speech synthesis where supported.

## Provider response contract
The chat endpoint expects a JSON object containing:
- `reply`: a non-empty conversational string.
- `extracted_memories`: an array of concise, explicitly stated, persistent user facts/preferences/goals/events. It should not contain transient moods, secrets, guesses, or information invented by the assistant.

The backend validates the shape and length of the fields before returning a normalized response. The frontend treats missing memory candidates as an empty list. The frontend state engine remains authoritative for vital updates; the LLM does not directly overwrite numeric vitals.

## Memory behavior
- Memories are **semantic** (lasting facts/preferences/goals) or **episodic** (dated events such as "exam tomorrow"). Users can delete any memory, add their own, switch memory off, and export all data.
- Deletions are synced to Supabase; local-only flags (follow-up done, added by user) are merged on load.
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
- [ ] "my brother said ur ugly" makes Kebo sad/hurt (not joyful) and does not lower the bond; "you are ugly" said directly is treated as an insult.
- [ ] "I am so sad" makes Kebo calm and attentive (not sad) and raises the bond.
- [ ] "please be quiet" gets a short calm reply and stops Kebo starting conversations for 30 minutes.
- [ ] Feed/Water/Sunlight/Play/Rest change the vitals; Fullness recovers.
- [ ] "I have an exam tomorrow" creates an episodic memory; after Settings → Demo speed and Activity → Simulate 3 hours away, Kebo follows up once.
- [ ] Refreshing the page keeps chat history, vitals, memories and activity log.
- [ ] Deleting a memory removes it after reload (including with Supabase configured).
- [ ] Stopping the backend switches the sidebar to "Offline mode" and chat still works.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` before final submission.

## Known limitations to disclose
- Emotion is simulated by application logic (rule-based appraisal plus vitals); it is not consciousness. The rules cover common English phrasing and can misread sarcasm or unusual wording.
- Replies arrive in one piece (no token streaming); there is no 3D avatar or interactive environment yet.
- Autonomous messages only run while the app is open in a browser tab; there is no server-side scheduler or push service.
- Current memory retrieval uses structured records and lexical relevance scoring, not vector embeddings.
- Current voice uses transcription plus browser speech synthesis, not a dedicated real-time voice model.
- The prototype's browser/device ID approach is demo-oriented (`supabase/memory_hardening.sql` restricts each request to its own device id, but it is not real authentication); production multi-user use needs authentication, per-user isolation, and verified database policies.
- LLM output and availability depend on the configured external provider.
- The code changes should be validated against the actual deployed environment; a repository update alone does not prove the live deployment is healthy.
