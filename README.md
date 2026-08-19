# Aegis AI — Voice Health Intake Screening Assistant

Aegis AI is an interactive, voice-based health intake screening assistant that gathers user symptoms, manages conversational context dynamically, and produces clinical-grade intake summaries. 

This repository contains both the **Node.js/TypeScript Backend Server** and the **Vite/React/TypeScript Frontend Client**.

---

## Technical Stack & API Pipeline

- **Backend**: Node.js, TypeScript, Express.js, `ws` (WebSockets), MongoDB, Mongoose.
- **Frontend**: Vite, React 19, TypeScript, Vanilla CSS, Lucide Icons.
- **AI Pipeline**:
  - **Speech-to-Text (STT)**: OpenAI Whisper API (`whisper-1`) or Groq STT (`whisper-large-v3`).
  - **Large Language Model (LLM)**: Cohere LLM (`command-r`) driving the screening conversation, state extraction, and clinical summary generation.
  - **Text-to-Speech (TTS)**: OpenAI TTS API (`tts-1`).
  - **Fallback / Mocks**: Full mock implementation options included for all services to test the environment locally with zero cost/API keys.

---

## Directory Structure

```text
├── server/                    # Node.js/TypeScript Backend Server
│   ├── src/
│   │   ├── config/            # Env and Database setups
│   │   ├── models/            # Mongoose schemas (Call, Message, HealthReport)
│   │   ├── services/          # Core logic (Call, Conversation, Report services)
│   │   │   └── ai/            # STT, LLM (OpenAI + Cohere), TTS abstractions
│   │   ├── websocket/         # WebSocket message controllers & protocols
│   │   ├── prompts/           # Conversation prompts & Report prompts
│   │   ├── middleware/        # Global error & Express validator middleware
│   │   ├── app.ts & server.ts # Server startup & routing
│   └── test-integration.js    # Automated integration test script
│
├── Frontend/                  # React Frontend Client
│   ├── src/
│   │   ├── services/          # Audio recording & Socket helpers
│   │   ├── App.tsx & App.css  # Application layout, views, and styling
│   │   └── main.tsx           # React entry point
```

---

## Quick Start (Local Setup)

### Prerequisites
- Node.js (v18 or higher)
- MongoDB running locally on `mongodb://localhost:27017`

### Step 1: Backend Server Setup
1. Open a terminal and navigate to the `server` directory:
   ```bash
   cd server
   ```
2. Install server dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
4. Configure your API keys and providers in `.env`:
   - Set `STT_PROVIDER`, `LLM_PROVIDER`, and `TTS_PROVIDER` to `openai`, `groq`, or `mock`.
   - Provide `OPENAI_API_KEY`, `GROQ_API_KEY`, or `COHERE_API_KEY` corresponding to your providers.
   - For example, to run on **Groq STT** and **Cohere LLM** (`command-r`):
     ```env
     STT_PROVIDER=groq
     LLM_PROVIDER=cohere
     TTS_PROVIDER=openai # (or 'mock' if you do not have OpenAI TTS keys)
     GROQ_API_KEY=gsk_your_groq_api_key
     COHERE_API_KEY=your_cohere_api_key
     OPENAI_API_KEY=your_openai_api_key
     ```
5. Compile TypeScript files:
   ```bash
   npm run build
   ```
6. Start the server in development mode:
   ```bash
   npm run dev
   ```
7. (Optional) Run the automated integration test script to verify endpoint functionality:
   ```bash
   node test-integration.js
   ```

### Step 2: Frontend Client Setup
1. Open a new terminal and navigate to the `Frontend` directory:
   ```bash
   cd Frontend
   ```
2. Install frontend dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to the URL shown in your console (usually `http://localhost:5173` or similar).

---

## API Documentation

### REST Endpoints
*   `GET /api/health` — Verifies server health.
*   `POST /api/calls` — Creates a new screening session (`{ language: 'en' | 'hi' }`).
*   `GET /api/calls/:callId` — Retrieves current call metadata.
*   `POST /api/calls/:callId/end` — Ends the call manually and triggers report compilation.
*   `GET /api/calls/:callId/report` — Retrieves the structured health report document.

### WebSocket Protocols (`ws://localhost:3001/ws/call/:callId`)
- Handles turn-based audio transmission:
  - Client sends: `audio.start` -> binary chunks as base64 string `audio.chunk` -> `audio.end`.
  - Server processes: returns `ai.processing` -> `transcript` (user text) -> `ai.response` (AI text + audio).
  - Handles `call.end` triggers and automatically publishes `call.ended`.

---

## License & Screening Disclaimer
This software is intended as an intake screening demonstration tool only. Aegis AI is not a medical professional, cannot offer medical advice, and is not designed to diagnose or treat health conditions.
