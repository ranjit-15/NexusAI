# Vercel Deployment Instructions

## Deploy to Vercel

1. **Install Vercel CLI** (optional):
   ```bash
   npm install -g vercel
   ```

2. **Deploy via GitHub** (Recommended):
   - Push your code to GitHub
   - Go to https://vercel.com
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel will auto-detect the settings from vercel.json
   - Add environment variable in Vercel dashboard:
     - Key: `GEMINI_API_KEY`
     - Value: Your API key
   - Click "Deploy"

3. **Deploy via CLI**:
   ```bash
   vercel
   ```
   - Follow the prompts
   - Set environment variable when prompted

## Environment Variables

In Vercel dashboard, add:
- `GEMINI_API_KEY` = Your Gemini API key

## Project Structure for Vercel

- `/api` - Serverless functions (backend)
- `/dist` - Built frontend (auto-generated)
- `vercel.json` - Deployment configuration

## Local Development

Still works the same:
1. Terminal 1: `npm run server` (for local backend)
2. Terminal 2: `npm run dev` (for local frontend)

Vercel will use the `/api` serverless functions in production.
