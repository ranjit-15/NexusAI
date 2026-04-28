# NexusAI — Free AI Chat Platform

A modern, unrestricted AI chat platform built with React + Vite, powered by Google Gemini and Gemma models.

## Features

- 🎨 Modern chat platform UI (sidebar, chat history, glassmorphism)
- 🤖 Multiple AI models (Gemini 2.5 Pro, Flash, Gemma 4, etc.)
- 🧠 Thinking mode for complex reasoning
- 🎭 Persona system (Assistant, Developer, Creative, etc.)
- 🎙 Voice input support
- 🔊 Text-to-speech (read aloud)
- 📋 Code syntax highlighting with copy
- 💾 Chat history with auto-save
- 📱 Fully responsive (mobile + desktop)
- 🚫 No content restrictions

## Local Development

```bash
# Install dependencies
npm install

# Start the API server
npm run server

# Start the frontend dev server (in another terminal)
npm run dev
```

Set your API key in `.env.local`:
```
GEMINI_API_KEY=your_key_here
```

## Deploy to Vercel

1. Push to GitHub
2. Connect repo to Vercel
3. Add `GEMINI_API_KEY` as environment variable in Vercel dashboard
4. Deploy

## Deploy to Firebase

```bash
npm install -g firebase-tools
firebase login
firebase init hosting functions
firebase deploy
```

Set the API key:
```bash
firebase functions:config:set gemini.api_key="your_key_here"
```
