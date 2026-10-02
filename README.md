# JARVIS Cloud + Windows — UI and Voice Consolidation

This is the same JARVIS architecture with a consolidated frontend redesign. No Supabase schema changes are required.

## What changed
- Voice input uses continuous browser recognition while wake mode is on, with automatic restart and live transcript feedback.
- Voice no longer depends on re-rendering the whole application after every command.
- Natural voice commands are routed to the existing intent parser before cloud AI.
- The chat composer is larger, auto-growing, and supports Enter-to-send / Shift+Enter.
- Added command suggestion chips, status telemetry, voice transcript feedback, and cleaner message bubbles.
- Existing Vercel API, Supabase database, Windows agent and Ollama paths remain unchanged.

## Platform note
Browser SpeechRecognition is still provided by the browser. A fully offline microphone transcription engine would require a local STT runtime; this build improves browser voice reliability and UX without adding another required local installation.
