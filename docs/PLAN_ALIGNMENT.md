# Plan vs. Implementation

This page compares the original Kebo plan (the 15-section design document) with what is built in this repository. Items are marked **Done**, **Partly**, or **Not done**. Use it to answer "what did you not finish?" honestly.

## Architecture

| Planned component | Status | What exists |
|---|---|---|
| Input and context processing | Done | Chat and push-to-talk input; recent conversation, relevant memories, vitals and personality are passed to the LLM. |
| Emotion engine | Done | `src/lib/appraisal.ts` (what a message means) and `src/lib/keboEngine.ts` (vitals, personality-scaled, gradual mood). Kebo does not copy the user's sadness. |
| Memory system | Partly | Short-term context, semantic facts, episodic events (e.g. "exam tomorrow"), relationship counters. Retrieval is lexical scoring, not embeddings or semantic search. |
| Personality system | Done | Seven traits (curiosity, playfulness, sensitivity, patience, sociability, courage, affection) change how events land and how often Kebo acts. Editable in Settings. |
| Kebo agent | Partly | `src/lib/agent.ts` runs an observe → evaluate → decide → act loop with anti-spam gates. See the action table below. |
| LLM reasoning and response | Done | OpenAI-compatible backend (Groq in deployment). Malformed or truncated replies are handled; a safety path answers self-harm messages with a fixed caring reply. |
| Output and state updates | Done | Vitals, relationship, memory, activity log and visual expression update after each turn and survive refresh. |

## Agent actions

| Planned action | Status | Notes |
|---|---|---|
| WAIT | Done | |
| SEND_MESSAGE | Done | LLM-phrased when the backend is online; template otherwise. |
| ASK_QUESTION | Done | |
| REQUEST_ATTENTION | Done | Only when loneliness is high and the bond is strong. |
| PLAY | Done | Ambient action on the Activity page. |
| CHANGE_ACTIVITY | Done | |
| REMIND_OWNER | Done as REFERENCE_MEMORY | Follows up once on an upcoming event the user mentioned. |
| BECOME_SILENT | Partly | Implemented as "be quiet" requests (30-minute quiet mode) and as the WAIT action. Not a separate action type. |
| EXPRESS_EMOTION | Partly | Emotion is shown through the character and the mood label, not as a separate agent action. |
| Added, not in plan | — | REST (when energy is low) and EXPLORE. |

## Voice

| Planned | Status | Notes |
|---|---|---|
| Audio capture and speech-to-text | Done | Browser recording, then Whisper transcription on the backend. |
| Transcript into the normal pipeline | Done | Same memory, emotion and LLM path as typed text. |
| Text-to-speech output | Done | Browser speech synthesis, with rate control and an on/off switch. |
| Voice interruption handling | Not done | Push-to-talk only; Kebo cannot be interrupted mid-speech. |
| Streaming audio, voice personality | Not done | |
| Real-time speech-to-speech | Not done | Stated as a limit in `docs/FINAL_REVIEW.md`. |

## Living environment and character

| Planned | Status | Notes |
|---|---|---|
| Plant creature whose look reflects its state | Done | Emotion-driven visuals on a 2D character. |
| Feeding, playing, resting | Done | Feed, Water, Sunlight, Play and Rest buttons change vitals. |
| Vitals or status panel | Done | Energy, happiness, bond, fullness, stimulation, annoyance, loneliness. |
| Interactive world, navigation, objects | Not done | The environment does not react beyond the character. |
| Day/night cycle, weather reactions, mini-games | Not done | |
| 3D Kebo, rigging, lip sync | Not done | The 2D character is the prototype avatar. |

## Relationship and continuity

| Planned | Status | Notes |
|---|---|---|
| Relationship evolution | Done | Five levels, visit streaks, milestones. Bond moves with the quality of interactions, not message count. |
| Returning user gets a greeting | Done | Welcome-back message after 30 minutes away. |
| Memory management by the user | Done | Delete, add, search, filter, turn off, export, erase. |

## Technology

| Planned | Status | Notes |
|---|---|---|
| Next.js | Changed | Built with React and Vite. The routing and rendering needs of this app do not require Next.js. |
| TypeScript, Tailwind CSS | Done | |
| shadcn/ui, Framer Motion, Zustand | Not used | Plain React state and CSS animations are used instead. |
| Database for memory | Done | Supabase (Postgres), with localStorage fallback. |
| Vector / semantic search | Not done | |
| Authentication and multi-user accounts | Not done | Device-based storage only; see `supabase/memory_hardening.sql`. |

## Phase 9 (polish) checklist

| Item | Status |
|---|---|
| Error handling for LLM, voice and storage failures | Done |
| Tests for memory, emotion, agent and appraisal | Done (43 unit tests, run in CI) |
| Autonomous-action limits reviewed | Done |
| Rate limiting and input caps on the backend | Done |
| Analytics and error monitoring | Not done |
| Cost controls | Partly: the LLM is called only when the rules are unsure, and endpoints are rate-limited. |
| Deployed frontend and backend | Done (Vercel and Render) |

## Summary for the review

Built as planned: the emotion engine, personality, memory with user control, the agent with controlled autonomy, text and push-to-talk voice, care interactions, and relationship progression.

Not built, and to be named as future work: the interactive world, 3D character, streaming and interruptible voice, semantic memory search, real user accounts, and analytics. The stack changed from Next.js to React and Vite for this project.
