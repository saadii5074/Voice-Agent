# 🎙️ VoiceTrack — Real-Time Multi-Speaker Voice Recognition & Tracking

A professional, production-quality web application for **anonymous real-time speaker diarization and tracking**. The system identifies and consistently tracks different voices within a live session — no name registration, no biometric profiles, no personal identification.

## 🎯 What This Is

**NOT** a person-identification system.  
**IS** a session-level anonymous speaker tracking system.

```
Voice A → Speaker 1
Voice B → Speaker 2
Voice A → Speaker 1  ← same voice, same label
Voice C → Speaker 3
Voice B → Speaker 2  ← same voice, same label
```

Speaker IDs are anonymous, session-scoped, and reset on new sessions.

---

## 🏗️ Architecture

```
Browser Microphone
       ↓
Web Audio API (Float32 → PCM16 @ 16kHz)
       ↓
WebSocket /ws/audio
       ↓
FastAPI Backend
       ↓
Deepgram Streaming API
  ├── Real-time STT (nova-2 model)
  ├── Speaker Diarization (diarize=True)
  └── Multilingual (language=multi)
       ↓
Speaker Tracker
  ├── Deepgram speaker_id → Anonymous Label mapping
  ├── Speaker 0 → "Speaker 1"
  ├── Speaker 1 → "Speaker 2"
  └── Consistent within session
       ↓
WebSocket /ws/events
       ↓
React Frontend UI
  ├── Current Speaker Display
  ├── Live Transcript
  └── Speaker List
```

---

## ⚙️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| Backend | Python + FastAPI |
| Real-time | WebSockets |
| Speech-to-Text | Deepgram Streaming API (nova-2) |
| Speaker Diarization | Deepgram built-in diarization |
| Speaker Tracking | Session-level speaker mapping |
| Audio | Web Audio API → PCM16 |

---

## 🚀 Installation & Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- Deepgram API Key (free at [deepgram.com](https://deepgram.com))

### Step 1: Clone / Setup

```bash
# The project is already on your Desktop
cd "c:\Users\Saadii\Desktop\voice agent"
```

### Step 2: Backend Setup

```bash
# Create virtual environment
python -m venv venv

# Activate (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r backend/requirements.txt
```

### Step 3: Configure Environment

```bash
# Copy example env file
copy .env.example .env

# Edit .env and add your Deepgram API key
notepad .env
```

Your `.env` file:
```env
DEEPGRAM_API_KEY=your_actual_deepgram_api_key_here
HOST=0.0.0.0
PORT=8000
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Step 4: Frontend Setup

```bash
cd frontend
npm install
cd ..
```

---

## ▶️ Running the Application

### Terminal 1 — Backend

```bash
# From project root, with venv activated
cd "c:\Users\Saadii\Desktop\voice agent"
.\venv\Scripts\Activate.ps1
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Backend runs at: `http://localhost:8000`  
API docs at: `http://localhost:8000/docs`

### Terminal 2 — Frontend

```bash
cd "c:\Users\Saadii\Desktop\voice agent\frontend"
npm run dev
```

Frontend runs at: `http://localhost:5173`

---

## 🧪 Testing the System

### Acceptance Test

1. Open `http://localhost:5173` in browser
2. Allow microphone access when prompted
3. Click **[ START LIVE SESSION ]**
4. **Person A** speaks: *"Assalam o Alaikum"*
   - ✅ Expected: **SPEAKER 1 IS SPEAKING** + transcript
5. **Person B** speaks: *"Wa Alaikum Assalam"*
   - ✅ Expected: **SPEAKER 2 IS SPEAKING** + transcript
6. **Person A** speaks again: *"How are you?"*
   - ✅ Expected: **SPEAKER 1 IS SPEAKING** (NOT Speaker 3!)
7. **Person C** speaks: *"Hello"*
   - ✅ Expected: **SPEAKER 3 IS SPEAKING**
8. **Person B** speaks: *"Nice to meet you"*
   - ✅ Expected: **SPEAKER 2 IS SPEAKING**

---

## 📡 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/session/start` | Start new session |
| `POST` | `/api/session/stop` | Stop session |
| `GET` | `/api/session/{id}` | Get session info |
| `GET` | `/api/session/{id}/transcript` | Get full transcript |
| `WS` | `/ws/audio?session_id=xxx` | Send audio stream |
| `WS` | `/ws/events?session_id=xxx` | Receive events |

---

## 📡 WebSocket Events

### Events (server → client via `/ws/events`)

```json
// Speaker changed
{"type": "speaker_change", "speaker": "Speaker 2", "session_id": "abc123"}

// New transcript segment
{
  "type": "transcript",
  "speaker": "Speaker 1",
  "text": "Assalam o Alaikum",
  "start_time": 1.2,
  "end_time": 2.5,
  "language": "ur",
  "is_final": true
}

// Speaker list updated
{"type": "speaker_list", "speakers": ["Speaker 1", "Speaker 2", "Speaker 3"]}

// Status update
{"type": "status", "message": "Speaker detection active", "level": "info"}

// Error
{"type": "error", "message": "Microphone access denied"}
```

---

## 🔒 Privacy

- ✅ No real names collected
- ✅ No permanent voice profiles stored
- ✅ No biometric identity database
- ✅ All speaker data is session-scoped only
- ✅ Session data cleared on session end
- ✅ Anonymous Speaker IDs only

---

## 📁 Project Structure

```
voice agent/
├── .env                    ← Your API keys (not committed)
├── .env.example            ← Template
├── README.md               ← This file
│
├── backend/
│   ├── main.py             ← FastAPI app entry point
│   ├── config.py           ← Settings & env vars
│   ├── session_manager.py  ← Session state management
│   ├── speaker_tracker.py  ← Anonymous speaker ID tracking
│   ├── deepgram_client.py  ← Deepgram streaming integration
│   ├── audio_processor.py  ← Audio pipeline
│   ├── websocket_manager.py ← WebSocket connections
│   ├── requirements.txt    ← Python dependencies
│   └── routers/
│       └── session.py      ← Session API routes
│
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── App.tsx
        ├── main.tsx
        ├── index.css
        ├── types/index.ts
        ├── hooks/
        │   ├── useSession.ts
        │   ├── useWebSocket.ts
        │   └── useAudioCapture.ts
        ├── components/
        │   ├── SessionControls.tsx
        │   ├── CurrentSpeaker.tsx
        │   ├── TranscriptView.tsx
        │   ├── SpeakerList.tsx
        │   ├── SessionInfo.tsx
        │   ├── StatusBar.tsx
        │   ├── QuestionBox.tsx
        │   └── AudioVisualizer.tsx
        ├── services/
        │   ├── api.ts
        │   ├── websocket.ts
        │   └── audioCapture.ts
        └── utils/
            ├── constants.ts
            └── formatters.ts
```

---

## ⚠️ Troubleshooting

### Microphone not working
- Check browser permissions (click 🔒 in address bar)
- Use HTTPS or localhost (required for mic access)
- Try Chrome or Edge (best Web Audio API support)

### "Deepgram connection failed"
- Verify `DEEPGRAM_API_KEY` in `.env`
- Check Deepgram dashboard for API key status
- Ensure internet connectivity

### Speaker not changing
- Deepgram diarization works best with distinct voices
- Ensure there's a brief pause between speakers
- Background noise can confuse diarization

### WebSocket connection error
- Ensure backend is running on port 8000
- Check CORS settings in `.env`
- Check browser console for specific errors

---

## 🗺️ Roadmap / Future Features

- [ ] Upload audio file for offline diarization
- [ ] WebRTC call audio input
- [ ] Meeting/Zoom audio integration
- [ ] Export transcript as PDF/DOCX
- [ ] AI-powered Q&A on session transcript
- [ ] Real-time translation
- [ ] Speaker statistics dashboard
- [ ] Session replay

---

## 📄 License

MIT License — For personal and commercial use.

---

*Built with ❤️ — Anonymous Speaker Tracking, Not Person Identification*
