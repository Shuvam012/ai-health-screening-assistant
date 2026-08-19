# Aegis AI — Voice Health Intake Screening Assistant

Aegis AI is an interactive, voice-based health intake screening assistant that gathers user symptoms, manages conversational context dynamically, and produces clinical-grade intake summaries. 

This repository contains both the **Node.js/TypeScript Backend Server** and the **Vite/React/TypeScript Frontend Client**.

---

## Technical Stack & API Pipeline

- **Backend**: Node.js, TypeScript, Express.js, `ws` (WebSockets), MongoDB, Mongoose.
- **Frontend**: Vite, React 19, TypeScript, Vanilla CSS, Lucide Icons.
- **AI Pipeline**:
  - **Speech-to-Text (STT)**: Sarvam AI STT (`saaras:v4`) integrated via their official Node SDK, supporting bilingual (Hindi/English) speech-to-text.
  - **Large Language Model (LLM)**: Google Gemini API (`gemini-3.6-flash`) driving the screening conversation, state extraction, and clinical summary generation.
  - **Text-to-Speech (TTS)**: Sarvam AI TTS (`bulbul:v3`) for high-quality audio responses.

---

## Directory Structure

```text
├── server/                    # Node.js/TypeScript Backend Server
│   ├── src/
│   │   ├── config/            # Environment configurations & database connections
│   │   ├── models/            # Mongoose schemas (Call, Message, HealthReport)
│   │   ├── services/          # Core business logic (Call, Conversation, Report services)
│   │   │   └── ai/            # AI service wrappers (Sarvam STT/TTS SDKs, Gemini LLM)
│   │   ├── websocket/         # WebSocket message controllers & protocols
│   │   ├── prompts/           # Conversation prompts & Report prompts
│   │   ├── middleware/        # Global error & validation middlewares
│   │   ├── app.ts & server.ts # Server startup, routes, and express setups
│   │   └── utils/             # Winston logging utils
│   └── test-integration.js    # Automated integration test script
│
├── Frontend/                  # React Frontend Client (Refactored & Modularized)
│   ├── src/
│   │   ├── components/        # Isolated UI components (Header, WelcomeScreen, CallScreen, ReportScreen)
│   │   ├── services/          # Audio recording & Socket helpers
│   │   ├── App.tsx            # Main application coordinator (orchestrates screens and states)
│   │   ├── App.css            # Stylesheets
│   │   ├── main.tsx           # React entry point
│   │   └── types.ts           # Unified TypeScript interface definitions
```

---

## Installation & Setup

### Prerequisites
- **Node.js** (v18 or higher)
- **MongoDB** running locally on `mongodb://localhost:27017`

### Step 1: Backend Server Setup
1. Navigate to the `server` directory:
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
4. Configure your API keys and parameters in `.env`:
   ```env
   # API Keys
   SARVAM_API_KEY=your_sarvam_api_key_here
   GEMINI_API_KEY=your_gemini_api_key_here

   # Providers
   STT_PROVIDER=sarvam
   LLM_PROVIDER=gemini
   TTS_PROVIDER=sarvam

   # Configuration
   SARVAM_STT_MODEL=saaras:v4
   SARVAM_TTS_MODEL=bulbul:v3
   GEMINI_MODEL=gemini-3.6-flash
   CORS_ORIGIN=http://localhost:5173
   ```
5. Compile TypeScript files:
   ```bash
   npm run build
   ```
6. Start the server in development mode:
   ```bash
   npm run dev
   ```

### Step 2: Frontend Client Setup
1. Navigate to the `Frontend` directory:
   ```bash
   cd ../Frontend
   ```
2. Install client dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:5173`.

---

## Technical Pipeline & Protocols

### REST Endpoints
*   `GET /api/health` — Verifies server health.
*   `POST /api/calls` — Creates a new screening session (`{ language: 'en' | 'hi' }`).
*   `GET /api/calls/:callId` — Retrieves current call metadata.
*   `POST /api/calls/:callId/end` — Ends the call manually and triggers report compilation.
*   `GET /api/calls/:callId/report` — Retrieves the structured health report document.

### WebSocket Protocols (`ws://localhost:3001/ws/call/:callId`)
- Handles real-time voice ingestion and streaming response generation:
  1. Client begins recording and sends: `{ type: "audio.start" }`.
  2. Client captures microphone audio using the browser's native **MediaRecorder API** to capture a compressed `audio/webm;codecs=opus` payload, converting it to base64.
  3. When recording stops, client sends: `{ type: "audio.chunk", data: base64Audio, mimeType: "audio/webm;codecs=opus" }` and `{ type: "audio.end" }`.
  4. Server consolidates WebM chunks into a memory buffer and forwards them to the **Sarvam STT SDK** with explicit MIME type metadata (`audio/webm`).
  5. STT returns a transcript which is saved to Mongoose and sent to **Google Gemini** to progress the diagnostic conversation.
  6. Gemini replies with a response text and extracted state, which is synthesized into speech using the **Sarvam TTS API**.
  7. Client receives the response text and audio buffer via WebSocket, playing it back to the user.

---

## Troubleshooting & Mic Capture Notice

> [!NOTE]
> If you experience silent audio transcription responses during local testing (e.g., the assistant repeats *"I couldn't quite catch that"*):
> 
> This is a known browser/driver compatibility bug related to **Intel® Smart Sound Technology (SST) Digital Microphones** on certain Windows laptops. The old `AudioContext` + `ScriptProcessorNode` manual PCM capture gets gated/muted at the OS/hardware layer.
> 
> To resolve this:
> 1. We refactored frontend recording to use the browser-native **MediaRecorder API** which records direct encoded WebM streams, bypassing deprecated AudioNode capture completely.
> 2. If it still occurs, check Chrome microphone permissions, verify that your default OS input device is set correctly, and check the bottom-left corner of the web interface to hear the recorded audio play back manually.
