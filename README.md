# NexusAI — Next-Generation AI Chat Platform

An open-access, account-free AI chat platform powered by Google Gemini and Gemma models. No sign-up required — just open and start chatting.

## ✨ Features

- **Multi-Model Support** — Gemma 4 31B (default), Gemini 2.5 Pro, Flash, and more
- **Thinking Mode** — Extended reasoning with visible thought budget
- **Image Generation** — Text-to-image via `/image` prompt
- **Voice I/O** — Speech-to-text input + text-to-speech playback
- **Image Attachments** — Attach images to your messages
- **LaTeX Math** — Renders mathematical equations with KaTeX
- **Export Chats** — Download as Markdown or Plain Text
- **Search** — Real-time search across all chat history
- **Smart Titles** — Auto-generated 3-4 word chat titles
- **Personas** — Assistant, Developer, Creative, Professional, and more
- **PWA** — Install as a native app on mobile/desktop
- **Your Own API Key** — Add your Gemini key for unlimited quota
- **Guest Persistence** — Chats saved to Firebase with no account needed

## 🗂 Project Structure

```
NexusAI/
├── App.tsx                  # Main app shell & state
├── index.tsx                # React entry point
├── index.css                # Global design system
├── index.html               # HTML entry + PWA meta
├── types.ts                 # Shared TypeScript types
├── components/
│   ├── ApiKeyModal.tsx       # API key settings + AI Studio guide
│   ├── ChatMessage.tsx       # Message renderer (markdown, code, math)
│   ├── ExportModal.tsx       # Export chat as MD or TXT
│   ├── Sidebar.tsx           # Chat history + search + export
│   └── TypingIndicator.tsx   # Streaming loading animation
├── constants/
│   └── personas.ts          # AI persona definitions
├── services/
│   └── geminiService.ts     # Frontend API service (streaming)
├── src/
│   ├── firebase.ts          # Firebase app initialization
│   └── firestoreService.ts  # Firestore CRUD (guest sessions)
├── server/
│   └── index.js             # Express proxy (rate limiting, validation)
├── functions/
│   └── index.js             # Firebase Cloud Functions (cleanup scheduler)
├── public/
│   ├── logo.png
│   ├── manifest.json        # PWA manifest
│   └── sw.js                # Service worker (offline cache)
├── firestore.rules          # Firestore security rules
├── firestore.indexes.json
├── firebase.json
├── vercel.json
├── vite.config.ts
└── tsconfig.json
```

## 🚀 Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment
```bash
# .env.local
GEMINI_API_KEY=your_key_here
```
Get a free key at [Google AI Studio](https://aistudio.google.com/app/apikey)

### 3. Run locally
```bash
# Terminal 1 — backend proxy
npm run server

# Terminal 2 — frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## 🔥 Deploy

### Firebase (Cloud Functions + Hosting)
```bash
firebase deploy
```

### Vercel (Frontend only)
Push to GitHub and connect to Vercel. Set `GEMINI_API_KEY` in Vercel env vars.

## 🔒 Security

- API keys are **never** stored on the frontend — all AI calls go through the Express proxy
- Rate limiting: 100 requests per 10 minutes per IP
- Firestore rules: each guest device can only access its own sessions
- Guest sessions older than 30 days are auto-deleted by a daily Cloud Function

## 📄 License

MIT — Built by Ranjit Yadav
