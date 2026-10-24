# 🌱 KEBO AI

### A living AI companion with memory, emotions, personality, and autonomous behavior.

> **KEBO is not just an AI chatbot.**
>
> It is an attempt to build a persistent digital companion that can remember its owner, develop a relationship, express simulated emotions, adapt its behavior, and initiate interactions autonomously.

---

## ✨ Overview

KEBO is an **agentic AI-powered virtual companion** inspired by the feeling of interacting with a living digital character rather than simply chatting with an AI assistant.

KEBO takes the idea of a virtual pet and combines it with:

* 🧠 Long-term memory
* ❤️ Emotion modeling
* 🧬 Personality traits
* 🤖 Agentic decision-making
* 💬 Natural language conversation
* 🔊 Voice interaction
* 🎮 Interactive virtual environments
* 🌱 A visually expressive plant-based character
* 📈 Relationship evolution

The goal is to create a companion that doesn't simply respond when spoken to, but maintains an evolving internal state and can decide when and how to interact with its owner.

---

# 🌱 What is Kebo?

KEBO is a small, humanoid, plant-based digital creature.

Unlike traditional virtual pets such as dogs, cats, or conventional robotic companions, Kebo is designed as an original fantasy-like plant organism.

Its appearance changes according to its internal emotional state.

| Emotional State | Visual Behavior                        |
| --------------- | -------------------------------------- |
| 💚 Happy        | Bright green glow, energetic movement  |
| 💙 Sad          | Wilted appearance, dimmer glow         |
| ❤️ Angry        | Red/orange glow, sharper movements     |
| ✨ Excited       | Increased glow and energetic animation |
| 😴 Sleepy       | Dim lighting, slow movement            |
| 🥺 Lonely       | Reduced glow, quiet behavior           |
| 👀 Curious      | Increased attention and exploration    |
| 🌱 Neutral      | Calm natural idle state                |

Kebo's visual state is driven by its internal state rather than being purely decorative.

---

# 🧠 The Core Idea

Traditional chatbot:

```text
User
 ↓
Message
 ↓
LLM
 ↓
Response
```

Basic emotion-aware chatbot:

```text
User
 ↓
Message
 ↓
Emotion Detection
 ↓
LLM
 ↓
Response
```

KEBO aims to go further:

```text
                    ┌───────────────┐
                    │     USER      │
                    └───────┬───────┘
                            │
                            ▼
                  ┌───────────────────┐
                  │ Input Understanding│
                  └─────────┬─────────┘
                            │
            ┌───────────────┼────────────────┐
            ▼               ▼                ▼
       ┌─────────┐    ┌───────────┐    ┌───────────┐
       │ Memory  │    │  Emotion  │    │Personality│
       │ System  │    │  Engine   │    │   Core    │
       └────┬────┘    └─────┬─────┘    └─────┬─────┘
            │               │                │
            └───────────────┼────────────────┘
                            ▼
                  ┌───────────────────┐
                  │   KEBO AGENT      │
                  │ Decision Engine    │
                  └─────────┬─────────┘
                            │
                  ┌─────────┴─────────┐
                  ▼                   ▼
             ┌─────────┐       ┌────────────┐
             │   LLM   │       │   Actions  │
             └────┬────┘       └──────┬─────┘
                  │                   │
                  └─────────┬─────────┘
                            ▼
                  ┌───────────────────┐
                  │  Kebo Expression  │
                  │  + Behavior       │
                  └───────────────────┘
```

This architecture allows language, memory, emotion, personality, and autonomous behavior to influence one another.

---

# ❤️ Emotion Engine

Kebo does not simply receive an emotion label from an LLM.

The planned system maintains a continuously evolving internal state.

Example:

```ts
{
  happiness: 78,
  energy: 84,
  affection: 71,
  loneliness: 12,
  trust: 82,
  anger: 4,
  curiosity: 88
}
```

These values can change based on:

* conversations
* user actions
* time
* interactions
* memories
* personality
* activities
* environmental events

For example:

```text
User gives Kebo attention
        ↓
Affection ↑
Happiness ↑
Loneliness ↓
        ↓
Kebo becomes happier
        ↓
Visual appearance changes
```

The emotion engine is intended to provide **consistent behavioral state**, rather than having the LLM randomly decide how Kebo feels.

> These emotions are computationally modeled states, not claims of actual consciousness or subjective feelings.

---

# 🧬 Personality Core

Every Kebo has a persistent personality profile.

The planned personality model contains seven major traits:

```text
Curiosity
Playfulness
Sensitivity
Patience
Sociability
Courage
Affection
```

Example:

```text
Curiosity      82
Playfulness    75
Sensitivity    68
Patience       42
Sociability    61
Courage        57
Affection      80
```

Personality influences behavior.

### High Curiosity

Kebo is more likely to:

* explore
* ask questions
* investigate objects
* initiate conversations

### High Playfulness

Kebo is more likely to:

* request games
* suggest activities
* behave energetically

### High Sensitivity

Kebo may react more strongly to emotionally significant interactions.

### High Patience

Loneliness and negative emotional changes accumulate more slowly.

### High Sociability

Kebo is more likely to initiate interactions.

The personality system allows different users to gradually experience different versions of Kebo.

---

# 🧠 Long-Term Memory

One of the central features of KEBO is persistent memory.

Kebo should not behave as if every conversation begins from zero.

Memory is planned to exist at multiple levels.

## Short-Term Memory

Recent conversation context.

```text
User: I'm nervous about tomorrow.

Kebo:
What happened tomorrow?
```

## Semantic Memory

Persistent facts about the owner.

```text
Owner likes rainy weather.
Owner enjoys games.
Owner is working on a software project.
Owner dislikes waking up early.
```

## Episodic Memory

Important events.

```text
2026-08-15
Owner told Kebo about an upcoming exam.

2026-08-18
Owner returned after being away for several days.

2026-08-20
Owner celebrated completing a project.
```

## Relationship Memory

Information about the evolving relationship.

```text
Affection
Trust
Familiarity
Interaction frequency
Important shared events
```

Future memory retrieval will use relevance rather than blindly sending the entire conversation history to the LLM.

---

# 🤖 Agentic Behavior

A key distinction between KEBO and a conventional chatbot is **autonomy**.

A normal chatbot waits for:

```text
User → Message → AI
```

Kebo should eventually be capable of:

```text
Kebo observes its state
        ↓
Kebo evaluates context
        ↓
Kebo decides whether action is appropriate
        ↓
Kebo chooses an action
        ↓
Kebo acts
```

Possible autonomous actions include:

```text
WAIT
SEND_MESSAGE
ASK_QUESTION
REQUEST_ATTENTION
PLAY
EXPLORE
REST
REFERENCE_MEMORY
CHANGE_ACTIVITY
```

For example:

```text
Time since interaction: 9 hours
Loneliness: 74
Energy: 68
Affection: 82
Owner previously mentioned an exam
        ↓
Agent evaluates context
        ↓
Decision:
Initiate conversation
        ↓
LLM generates contextual message
        ↓
Kebo:
"Hey... how did your exam go?"
```

The agent should **not constantly interrupt the user**.

Autonomous behavior should be contextual, sparse, and controllable.

---

# 💬 Natural Conversation

KEBO will use an LLM as its natural-language layer.

The LLM will receive relevant information such as:

```text
Current emotional state
Personality
Relevant memories
Recent conversation
Current activity
Relationship context
Agent-selected intention
```

Rather than simply asking:

> "Respond to the user."

The system can provide context such as:

```text
Kebo is curious and slightly lonely.

The owner previously mentioned an exam today.

The owner has just returned.

Relevant memory:
The owner was nervous about the exam yesterday.

Respond naturally as Kebo.
```

This allows responses to be contextual rather than generic.

---

# 🔊 Voice Interaction

A future version of Kebo will support voice interaction.

Potential interaction:

```text
User speaks
     ↓
Speech-to-Text
     ↓
Kebo Agent
     ↓
Memory + Emotion + Personality
     ↓
LLM
     ↓
Text response
     ↓
Text-to-Speech
     ↓
Kebo speaks
```

Voice should be treated as another interface to Kebo's underlying intelligence rather than a separate chatbot.

---

# 🎮 Interactive Virtual World

The long-term vision is to move beyond a chat interface.

Kebo should eventually exist inside a small interactive environment.

Possible activities:

* walking
* sleeping
* exploring
* playing
* resting
* interacting with objects
* reacting to the environment
* responding to the time of day
* reacting to weather
* seeking the owner's attention

The user should feel like they are **visiting Kebo's world**, not opening another chat application.

---

# 🧍 3D Kebo

The current prototype uses a 2D character representation.

The long-term goal is a fully interactive **3D Kebo**, similar in spirit to modern virtual-pet experiences.

The architecture is intentionally designed around:

```text
Kebo Engine
     ↓
Kebo State
     ↓
Kebo Avatar Interface
     ↓
┌───────────────────┐
│  2D Kebo          │  ← prototype
│  3D Kebo          │  ← future
└───────────────────┘
```

The intelligence layer should not depend on the rendering technology.

This allows the character representation to evolve without rebuilding Kebo's memory, personality, or agent systems.

---

# 🌍 Kebo Environment

The environment should react to Kebo.

Examples:

### Happy Kebo

* brighter environment
* lively particles
* stronger green lighting

### Sad Kebo

* dimmer environment
* slower movement
* reduced particle activity

### Sleepy Kebo

* darker atmosphere
* slow animations
* quieter environment

The environment becomes another way of communicating Kebo's internal state without requiring text.

---

# 📱 User Experience

The planned application will include:

### Home

Kebo's living environment.

### Talk

Natural conversation with Kebo.

### Memories

View important memories and shared experiences.

### Relationship

View relationship development and interaction history.

### Activity

See what Kebo has been doing and when it acted autonomously.

### Settings

Configure:

* personality
* notifications
* voice
* privacy
* autonomy
* appearance
* interaction preferences

---

# 🏗️ Planned Architecture

A high-level future architecture:

```text
                    KEBO CLIENT
                         │
                ┌────────┴────────┐
                │                 │
             Web App          Mobile App
                │                 │
                └────────┬────────┘
                         │
                         ▼
                    KEBO API
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
    Conversation      Agent         User/Profile
       Service        Engine           Service
          │              │              │
          └──────────────┼──────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
       LLM Layer     Memory System   Emotion Engine
                         │
                    ┌────┴────┐
                    ▼         ▼
                Semantic   Structured
                 Memory     State
```

---

# 🛠️ Technology Direction

The exact technology stack may evolve, but the project is currently designed around:

### Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS
* shadcn/ui
* Framer Motion
* Zustand

### AI

* Large Language Model
* Natural Language Processing
* Agentic decision system
* Emotion/state modeling
* Memory retrieval

### Memory

Potential future components:

* relational database for structured state
* vector/semantic storage for long-term memories
* retrieval pipeline
* memory importance scoring

### Voice

Potential future components:

* Speech-to-Text
* Text-to-Speech
* streaming audio

### 3D

Potential future direction:

* WebGL / Three.js ecosystem
* React-based 3D rendering
* custom 3D character
* skeletal animation
* facial/expression states

The final technology choices will be made based on performance, cost, quality, and deployment requirements rather than forcing a particular stack.

---

# 🗺️ Development Roadmap

## Phase 1 — 🌱 Product Foundation

* [x] Next.js application
* [x] Kebo visual prototype
* [x] Main navigation
* [x] Home
* [x] Talk
* [x] Memories
* [x] Relationship
* [x] Activity
* [x] Settings
* [x] Responsive interface
* [x] Mock data
* [x] Initial animations

---

## Phase 2 — ❤️ Living Kebo

* [ ] Centralized Kebo state
* [ ] Emotion engine
* [ ] Personality Core
* [ ] Mood-driven visual states
* [ ] Time-based state changes
* [ ] Activity system
* [ ] Mock autonomous behavior
* [ ] Relationship progression
* [ ] Contextual thoughts
* [ ] Improved character animation

---

## Phase 3 — 🧠 Conversational Intelligence

* [ ] LLM integration
* [ ] Context-aware responses
* [ ] Streaming responses
* [ ] Conversation orchestration
* [ ] Prompt/context management
* [ ] Safety controls
* [ ] Error handling
* [ ] Usage/cost controls

---

## Phase 4 — 🧠 Long-Term Memory

* [ ] Persistent user accounts
* [ ] Conversation storage
* [ ] Semantic memory
* [ ] Episodic memory
* [ ] Memory importance scoring
* [ ] Memory retrieval
* [ ] Memory consolidation
* [ ] User-controlled memory management

---

## Phase 5 — 🤖 Autonomous Kebo Agent

* [ ] Agent decision engine
* [ ] Autonomous action selection
* [ ] Context-aware initiation
* [ ] Scheduled evaluation
* [ ] Background jobs
* [ ] User-controlled autonomy
* [ ] Notification system
* [ ] Anti-spam behavior controls

---

## Phase 6 — 🔊 Voice

* [ ] Speech-to-text
* [ ] Text-to-speech
* [ ] Voice conversations
* [ ] Streaming audio
* [ ] Voice personality
* [ ] Voice interruption handling

---

## Phase 7 — 🧍 3D Kebo

* [ ] 3D character model
* [ ] Rigging
* [ ] Facial expressions
* [ ] Emotion-driven animation
* [ ] Idle animations
* [ ] Lip synchronization
* [ ] Interactive gestures
* [ ] Character rendering optimization

---

## Phase 8 — 🎮 Living World

* [ ] Interactive environment
* [ ] Kebo navigation
* [ ] Objects and activities
* [ ] Day/night cycle
* [ ] Environmental reactions
* [ ] Mini-games
* [ ] Character interactions

---

## Phase 9 — 🚀 Productization

* [ ] Authentication
* [ ] User onboarding
* [ ] Privacy controls
* [ ] Memory management
* [ ] Notification preferences
* [ ] Performance optimization
* [ ] Analytics
* [ ] Error monitoring
* [ ] Production deployment
* [ ] Mobile experience
* [ ] Cost optimization

---

# 🔐 Privacy & Memory Philosophy

Because Kebo is designed to remember personal interactions, privacy is a core design consideration.

Future versions should provide users with control over:

* what Kebo remembers
* deleting memories
* clearing conversations
* disabling long-term memory
* disabling autonomous interactions
* notification preferences
* account data

The goal is for memory to strengthen the relationship **without removing user control**.

---

# ⚠️ Important Technical Disclaimer

KEBO's emotions are **computationally modeled internal states**.

The project does not claim that an LLM or virtual character possesses genuine human emotions, consciousness, or subjective experience.

The "living companion" concept refers to the application's ability to maintain persistent state, memory, personality, and adaptive behavior.

---

# 🎯 Project Goals

KEBO is being developed as both:

1. A serious exploration of **agentic AI and persistent AI companions**
2. A portfolio/academic project demonstrating practical AI engineering

The project explores how multiple AI components can work together:

```text
LLM
+
Memory
+
Emotion
+
Personality
+
Agentic Decision Making
+
Voice
+
Interactive Character
=
KEBO
```

The goal is not merely to make an AI that can answer questions.

The goal is to explore what it takes to create an AI character that can **maintain context, develop an evolving relationship, and behave consistently over time.**

---

# 🌱 Current Status

**Status:** Final-review build. Implemented now:

- **Appraisal engine** (`src/lib/appraisal.ts`): understands who a message is aimed at, relayed speech ("my brother said…"), negation, requests for quiet, care and safety. Unsure cases are refined by the LLM.
- **Emotion engine** (`src/lib/keboEngine.ts`): appraisal → personality-scaled vitals → emotion. Moods change gradually, and fade back to the vitals-derived mood.
- **7-trait personality** (curiosity, playfulness, sensitivity, patience, sociability, courage, affection), editable in Settings, and it really changes outcomes.
- **Memory**: semantic (facts) + episodic (dated events such as "exam tomorrow"), per-item delete, manual add, on/off, export. Supabase with localStorage fallback.
- **Autonomous agent** (`src/lib/agent.ts`): scores WAIT / SEND_MESSAGE / ASK_QUESTION / REQUEST_ATTENTION / PLAY / EXPLORE / REST / REFERENCE_MEMORY / CHANGE_ACTIVITY with anti-spam gates, autonomy levels, "be quiet" support, event follow-ups and optional notifications. Every action is logged with its reason on the Activity page.
- **Relationship** page: levels, streaks, milestones. **Care** actions: feed, water, sunlight, play, rest.
- Chat history, vitals and activity persist across refreshes; offline fallback brain if the backend is down; mobile navigation; live backend status.
- Backend: rate limiting, input caps, crisis-safe replies, `/api/kebo-initiate`.

Not yet implemented (future scope): token streaming, 3D avatar, interactive environment, authentication/multi-device accounts.

**Demo tip:** Settings → *Demo speed* (30× time) and Activity → *Simulate 3 hours away* make loneliness and autonomous behaviour visible live.

## Tests

```powershell
npm test        # unit tests: appraisal, emotion engine, agent, memory
npm run typecheck
npm run lint
```

---

# 👩‍💻 Author

**Akshaya**

Integrated M.Tech — Software Engineering

KEBO is an independent project exploring agentic AI, conversational systems, persistent memory, emotion modeling, and interactive digital companions.

---

# 📜 License

License to be determined.

This project is currently an independent development project and may change licensing terms before public release.

---

# Current Setup

The app currently includes:

- React/Vite frontend
- Express backend with Groq-compatible LLM calls
- Structured emotion analysis and reasoning plans
- Supabase-backed memory with localStorage fallback
- Push-to-talk audio recording with Whisper transcription
- Voice replies through browser speech synthesis

## Local Development

Run the backend and frontend in separate terminals:

```powershell
npm run server
npm run dev
```

The frontend runs at `http://localhost:5173` and the backend at `http://localhost:3001`.

## Deployment

Deploy the backend using `render.yaml` on Render. Set `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `TRANSCRIPTION_MODEL`, and `CLIENT_ORIGIN` in Render environment variables.

Deploy the Vite frontend on Vercel. Set `VITE_KEBO_API_URL`, `VITE_KEBO_ANALYZE_URL`, and `VITE_KEBO_TRANSCRIBE_URL` to the deployed backend endpoints. Set the Supabase public URL and anon key as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

Never commit `.env` or private API keys.
