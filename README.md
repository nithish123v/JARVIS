# JARVIS — ONE BUILD (GitHub + Vercel + Supabase + Windows)

A single, no-build web project for JARVIS. It is intentionally plain HTML/CSS/ES modules so the Vercel deployment does not depend on a fragile front-end build step.

## Architecture

```text
GitHub → Vercel
            │
            ├─ JARVIS HUD (index.html/app.js/style.css)
            └─ /api/chat → OpenRouter
                       │
                       ▼
                 Supabase Auth/DB
                       │
                       ▼
              Windows JARVIS Agent
                       │
            ┌──────────┴──────────┐
            │                     │
          Ollama              Windows PC
          Qwen               control/media
```

The browser never receives the OpenRouter secret or the Supabase service-role key. The service-role key stays in the local Windows agent only.

## Deploy to Vercel

1. Create/import a GitHub repository and push this project.
2. Import the repository in Vercel. The repository root is the Vercel root; no framework-specific root directory is required.
3. In Vercel Project Settings → Environment Variables, add:

```text
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
JARVIS_DEVICE_ID=home-pc
OPENROUTER_API_KEY=YOUR_OPENROUTER_API_KEY
OPENROUTER_MODEL=google/gemma-4-26b-a4b-it:free
OPENROUTER_FALLBACKS=google/gemma-4-31b-it:free,nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free
```

4. Redeploy after adding/changing variables.

The public `SUPABASE_PUBLISHABLE_KEY` is intentionally used by the browser. The service-role key must never be used in browser code.

## Configure Supabase

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `supabase/schema.sql` exactly once.
4. Create your user with the Supabase Auth email/password UI or from the JARVIS sign-up button.

RLS allows a signed-in user to read/insert only their own chat and command rows. The local agent uses the service-role key to read commands for its configured `device_id` and write results.

## Configure the Windows Agent

Copy `windows-agent/.env.example` to `windows-agent/.env` and fill in:

```text
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
JARVIS_DEVICE_ID=home-pc
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:3b
JARVIS_WEATHER_CITY=Coimbatore
POLL_SECONDS=1.0
```

Your existing local Ollama setup can remain unchanged. The agent uses Python's standard library only; no pip packages are required.

Run a safe self-test:

```cmd
cd /d E:\JARVIS\JARVIS-CLOUD-ONE-BUILD\windows-agent
"E:\python\python-3.14.8-embed-amd64\python.exe" agent.py --self-test
```

Then start the agent:

```cmd
cd /d E:\JARVIS\JARVIS-CLOUD-ONE-BUILD\windows-agent
"E:\python\python-3.14.8-embed-amd64\python.exe" agent.py
```

## Commands supported by the one command router

- Time, date, year
- Open/close Notepad, Calculator, File Explorer, Chrome, Edge, Terminal, CMD, PowerShell, Task Manager, Settings, Paint, VS Code, Word, Excel, PowerPoint, Spotify, Discord
- Open URL / website and Google search
- Play **any** song or video through YouTube search and first matching video when YouTube exposes a video ID
- Close current browser tab and active window
- Media play/pause, next, previous
- Volume up/down/mute/set
- Brightness up/down/set
- Screenshot
- Weather
- Calculator
- PC/system information
- Lock PC
- Restart and shutdown, always gated by a confirmation dialog
- General AI questions through OpenRouter
- Automatic local Ollama fallback when OpenRouter is unavailable, rate-limited, unconfigured, or times out
- Browser voice input with WAKE mode and text fallback
- Supabase-persisted chat history

## YouTube behavior

The command router is generic; it does not contain a hard-coded song name. Examples:

```text
Play Believer
Play Kesariya by Arijit Singh
Play any Imagine Dragons song
Play the GTA 6 trailer
Open YouTube and play the Interstellar trailer
```

The Windows agent first tries to discover a YouTube `videoId`. If YouTube changes its HTML and the ID cannot be found, JARVIS opens the search results instead of inventing a link.

## GitHub push

```cmd
git init
git add .
git commit -m "JARVIS one build"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## Tests performed for this build

- Command-router unit tests: generic songs/videos, close-tab/close-app, time/date, volume/brightness, screenshot, calculator and confirmation routing.
- Python agent syntax check.
- Python agent self-test for time/date/year/calculator/core loading.
- JavaScript syntax/transpile check for the browser and Vercel files.
- Vercel/Supabase live deployment cannot be verified without your own project URL/keys; the repository therefore contains no fake credentials or claim of a completed external deployment.
