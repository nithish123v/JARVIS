import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parseIntent } from './intent.js';

const appEl = document.getElementById('app');
let supabase = null;
let config = { deviceId: 'home-pc', cloudConfigured: false };
let state = {
  session: null,
  messages: [],
  busy: false,
  listening: false,
  wake: false,
  speaking: false,
  cloud: false,
  agent: false,
  confirm: null,
  status: 'BOOTING',
  interim: '',
  lastError: ''
};
let recognition = null;
let restartTimer = null;
let agentTimer = null;
let voiceRequested = false;
let voiceMode = 'manual';

const nowTime = () => new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }).format(new Date());
const esc = (s) => {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
};

function addMessage(role, text) {
  const message = { role, text: String(text ?? ''), time: nowTime() };
  state.messages.push(message);
  appendMessageNode(message);
  scrollMessages();
}

function setStatus(status) {
  state.status = status;
  document.querySelectorAll('[data-status]').forEach((e) => { e.textContent = status; });
}

function setBusy(v) {
  state.busy = Boolean(v);
  const send = document.querySelector('[data-send]');
  if (send) send.disabled = state.busy;
  const mic = document.querySelector('[data-mic]');
  if (mic) mic.disabled = state.busy && !state.listening;
}

function scrollMessages() {
  const box = document.querySelector('[data-messages]');
  if (box) box.scrollTop = box.scrollHeight;
}

function updateLiveUI() {
  const orb = document.querySelector('[data-orb]');
  if (orb) orb.className = `orb ${state.listening ? 'listening' : ''} ${state.speaking ? 'speaking' : ''}`;
  const voice = document.querySelector('[data-voice-state]');
  if (voice) voice.textContent = state.speaking ? 'SPEAKING' : state.listening ? 'LISTENING' : 'STANDBY';
  const wake = document.querySelector('[data-wake]');
  if (wake) {
    wake.textContent = state.wake ? 'WAKE • ON' : 'WAKE • OFF';
    wake.classList.toggle('active', state.wake);
  }
  const ai = document.querySelector('[data-ai]');
  if (ai) ai.textContent = state.cloud ? 'OPENROUTER' : 'OLLAMA LOCAL';
  document.querySelectorAll('[data-agent-pill]').forEach((e) => {
    e.textContent = state.agent ? 'PC ONLINE' : 'PC OFFLINE';
    e.className = `pill ${state.agent ? 'online' : 'offline'}`;
  });
  document.querySelectorAll('[data-cloud-pill]').forEach((e) => {
    const aiOnline = state.cloud || state.agent;
    e.textContent = aiOnline ? 'AI ONLINE' : 'AI OFFLINE';
    e.className = `pill ${aiOnline ? 'online' : 'offline'}`;
  });
  const live = document.querySelector('[data-live-transcript]');
  if (live) {
    live.textContent = state.interim || (state.listening ? 'Listening for your command…' : 'Press the microphone and speak');
    live.classList.toggle('active', state.listening || Boolean(state.interim));
  }
  const mic = document.querySelector('[data-mic]');
  if (mic) {
    mic.classList.toggle('active', state.listening);
    mic.setAttribute('aria-pressed', String(state.listening));
    mic.title = state.listening ? 'Stop listening' : 'Start voice input';
  }
}

function appendMessageNode(message) {
  const box = document.querySelector('[data-messages]');
  if (!box) return;
  const row = document.createElement('article');
  row.className = `msg ${message.role}`;
  row.innerHTML = `<div class="avatar">${message.role === 'assistant' ? 'J' : 'YOU'}</div><div class="bubble"><div>${esc(message.text)}</div><span>${esc(message.time)}</span></div>`;
  box.appendChild(row);
}

function renderMessages() {
  const box = document.querySelector('[data-messages]');
  if (!box) return;
  box.innerHTML = '';
  for (const message of state.messages) appendMessageNode(message);
  scrollMessages();
}

function renderLoading() {
  appEl.innerHTML = '<div class="splash"><div class="splash-ring"></div><div class="splash-title">J.A.R.V.I.S.</div><div class="splash-sub">INITIALIZING COMMAND CORE</div></div>';
}

function renderAuth() {
  appEl.innerHTML = `<div class="auth-shell"><div class="stars"></div><div class="auth-card glass"><div class="brand-mark">J.A.R.V.I.S.</div><div class="auth-subtitle">GITHUB // VERCEL // SUPABASE // WINDOWS AGENT</div><h1>COMMAND CORE</h1><p class="muted">Secure sign-in for your personal JARVIS command center.</p>${!supabase ? `<div class="warning"><b>Supabase is not configured.</b><br><br>Check the Vercel environment variables and redeploy.</div>` : ''}<form data-auth class="auth-form"><label>Email<input name="email" type="email" placeholder="you@example.com" autocomplete="email" required></label><label>Password<input name="password" type="password" placeholder="••••••••" autocomplete="current-password" required minlength="6"></label><button class="primary" type="submit" ${!supabase ? 'disabled' : ''}>AUTHENTICATE</button></form><button class="text-btn" data-signup>Create account</button><div class="small-note">Device <b>${esc(config.deviceId)}</b></div></div></div>`;
  document.querySelector('[data-auth]')?.addEventListener('submit', authSubmit);
  document.querySelector('[data-signup]')?.addEventListener('click', signup);
}

function renderApp() {
  appEl.innerHTML = `<div class="app-shell"><div class="scanlines"></div><header class="topbar glass"><div class="brand"><span class="dot"></span><span>J.A.R.V.I.S.</span></div><div class="top-status"><span class="pill online" data-cloud-pill>AI ONLINE</span><span class="pill ${state.agent ? 'online' : 'offline'}" data-agent-pill>${state.agent ? 'PC ONLINE' : 'PC OFFLINE'}</span><span class="pill muted-pill" data-status>${esc(state.status)}</span></div><button class="ghost" data-signout>SIGN OUT</button></header><main class="layout"><aside class="left-panel glass"><div class="orb-wrap"><div class="orb ${state.listening ? 'listening' : ''} ${state.speaking ? 'speaking' : ''}" data-orb><div class="orb-core"></div><div class="orb-sheen"></div><div class="ring r1"></div><div class="ring r2"></div><div class="ring r3"></div></div></div><div class="hud-title">COMMAND CORE</div><div class="telemetry"><div><span>DEVICE</span><b>${esc(config.deviceId)}</b></div><div><span>VOICE</span><b data-voice-state>${state.speaking ? 'SPEAKING' : state.listening ? 'LISTENING' : 'STANDBY'}</b></div><div><span>AI</span><b data-ai>${state.cloud ? 'OPENROUTER' : 'OLLAMA LOCAL'}</b></div></div><button class="wake ${state.wake ? 'active' : ''}" data-wake>${state.wake ? 'WAKE • ON' : 'WAKE • OFF'}</button><div class="voice-caption"><span class="live-dot"></span><span data-live-transcript>Press the microphone and speak</span></div><div class="quick-grid"><button data-q="What is the time?">TIME</button><button data-q="Open YouTube">YOUTUBE</button><button data-q="Play a random music video">PLAY</button><button data-q="Take a screenshot">SCREENSHOT</button></div><div class="left-foot"><span>LOCAL CONTROL</span><span>OLLAMA</span><span>WINDOWS</span></div></aside><section class="chat-panel glass"><div class="panel-head"><div><span class="eyebrow">ACTIVITY STREAM</span><h2>JARVIS ONLINE</h2><p>Talk naturally. Type normally. JARVIS routes device commands locally and uses AI for conversation.</p></div><div class="session-meta"><span>DEVICE</span><b>${esc(config.deviceId)}</b><small data-status>${esc(state.status)}</small></div></div><div class="messages" data-messages></div><div class="composer-wrap"><div class="composer"><button class="mic ${state.listening ? 'active' : ''}" data-mic aria-label="Voice input" aria-pressed="${state.listening}"><span class="mic-icon">●</span><span class="mic-label">${state.listening ? 'LISTENING' : 'VOICE'}</span></button><div class="input-shell"><textarea data-input rows="1" placeholder="Message JARVIS…" aria-label="Message JARVIS"></textarea><div class="input-meta"><span>Enter to send • Shift+Enter for a new line</span><span data-char-count>0</span></div></div><button class="send" data-send><span>SEND</span><span class="send-arrow">↗</span></button></div><div class="suggestions"><button data-q="What time is it now?">Current time</button><button data-q="Open Chrome">Open Chrome</button><button data-q="Play a song on YouTube">Play on YouTube</button><button data-q="What's the weather in Coimbatore?">Weather</button><button data-q="Explain neuroplasticity simply">Ask AI</button></div></div></section></main></div>${state.confirm ? `<div class="modal-backdrop"><div class="confirm glass"><div class="eyebrow">SECURITY CHECK</div><h3>${state.confirm.type === 'RESTART_PC' ? 'Restart this PC?' : 'Shut down this PC?'}</h3><p>This action affects the Windows computer connected to JARVIS.</p><div class="confirm-actions"><button class="ghost" data-cancel>CANCEL</button><button class="danger" data-confirm>CONFIRM</button></div></div></div>` : ''}`;

  document.querySelector('[data-signout]')?.addEventListener('click', () => supabase?.auth.signOut());
  document.querySelector('[data-wake]')?.addEventListener('click', () => {
    state.wake = !state.wake;
    if (state.wake) {
      voiceMode = 'wake';
      startListening();
    } else {
      stopListening();
    }
    updateLiveUI();
  });
  document.querySelector('[data-mic]')?.addEventListener('click', () => {
    if (state.listening) stopListening();
    else {
      voiceMode = 'manual';
      startListening();
    }
  });
  document.querySelector('[data-send]')?.addEventListener('click', () => submit());
  document.querySelectorAll('[data-q]').forEach((button) => button.addEventListener('click', () => submit(button.dataset.q)));
  document.querySelector('[data-cancel]')?.addEventListener('click', () => { state.confirm = null; renderApp(); });
  document.querySelector('[data-confirm]')?.addEventListener('click', confirmExecute);

  const input = document.querySelector('[data-input]');
  input?.addEventListener('input', () => {
    autoGrow(input);
    const count = document.querySelector('[data-char-count]');
    if (count) count.textContent = String(input.value.length);
  });
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  });
  renderMessages();
  updateLiveUI();
}

function autoGrow(input) {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 150)}px`;
}

async function authSubmit(e) {
  e.preventDefault();
  if (!supabase) return;
  const f = new FormData(e.currentTarget);
  const { data, error } = await supabase.auth.signInWithPassword({ email: f.get('email'), password: f.get('password') });
  if (error) return alert(error.message);
  state.session = data.session;
  await startSession();
  renderApp();
}

async function signup() {
  if (!supabase) return;
  const email = prompt('Email:');
  if (!email) return;
  const password = prompt('Password (6+ characters):');
  if (!password) return;
  const { error } = await supabase.auth.signUp({ email, password });
  alert(error ? error.message : 'Account created. You can sign in now if email confirmation is disabled.');
}

async function startSession() {
  const uid = state.session?.user?.id;
  if (!uid || !supabase) return;
  const { data } = await supabase.from('chat_messages').select('role,content,created_at').eq('user_id', uid).order('created_at', { ascending: true }).limit(120);
  if (data?.length) state.messages = data.map((m) => ({ role: m.role, text: m.content, time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }));
  await checkAgent();
  clearInterval(agentTimer);
  agentTimer = setInterval(checkAgent, 15000);
}

async function checkAgent() {
  if (!supabase || !state.session || state.busy) return;
  try {
    const { data, error } = await supabase.from('pc_commands').insert({ user_id: state.session.user.id, device_id: config.deviceId, command_type: 'PING', payload: { type: 'PING' }, status: 'queued' }).select('id').single();
    if (error) throw error;
    const result = await waitCommand(data.id, 4);
    state.agent = result.status === 'completed';
  } catch {
    state.agent = false;
  }
  updateLiveUI();
}

async function saveChat(role, content) {
  if (supabase && state.session) await supabase.from('chat_messages').insert({ user_id: state.session.user.id, role, content });
}

async function queue(intent) {
  if (!supabase || !state.session) throw new Error('Please sign in to use Windows control.');
  const { data, error } = await supabase.from('pc_commands').insert({ user_id: state.session.user.id, device_id: config.deviceId, command_type: intent.type, payload: intent, status: 'queued' }).select('id').single();
  if (error) throw new Error(error.message);
  return data.id;
}

async function waitCommand(id, maxSeconds = 30) {
  for (let i = 0; i < Math.ceil(maxSeconds / 0.6); i += 1) {
    const { data } = await supabase.from('pc_commands').select('status,response,error').eq('id', id).maybeSingle();
    if (data && (data.status === 'completed' || data.status === 'error')) return data;
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  return { status: 'error', error: 'Windows agent timeout. Start the JARVIS Windows Agent on your PC.' };
}

async function cloudChat(prompt) {
  const history = state.messages.slice(-12).map((m) => ({ role: m.role, content: m.text }));
  const r = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [...history, { role: 'user', content: prompt }] }) });
  const j = await r.json().catch(() => ({}));
  if (r.ok && j.text) {
    state.cloud = true;
    return j.text;
  }
  state.cloud = false;
  if (j.fallbackLocal) return null;
  throw new Error(j.error || `Cloud AI HTTP ${r.status}`);
}

async function submit(forcedText, options = {}) {
  const el = document.querySelector('[data-input]');
  const text = String(forcedText ?? el?.value ?? '').trim();
  if (!text || state.busy) return;
  if (el && !forcedText) el.value = '';
  state.interim = '';
  updateLiveUI();

  addMessage('user', text);
  void saveChat('user', text);
  setBusy(true);
  setStatus('PROCESSING');

  const intent = parseIntent(text);
  if (options.fromVoice && !state.wake) stopListening();

  try {
    if (intent.type === 'AI_CHAT') {
      let cloud = null;
      try { cloud = await cloudChat(text); } catch { cloud = null; }
      if (cloud) {
        addMessage('assistant', cloud);
        void saveChat('assistant', cloud);
        speak(cloud);
      } else {
        const id = await queue({ type: 'AI_CHAT', prompt: text });
        const result = await waitCommand(id);
        if (result.status !== 'completed') throw new Error(result.error);
        addMessage('assistant', result.response);
        void saveChat('assistant', result.response);
        speak(result.response);
      }
    } else if (intent.needsConfirm) {
      state.confirm = intent;
      setBusy(false);
      setStatus('CONFIRMATION REQUIRED');
      renderApp();
      return;
    } else {
      const id = await queue(intent);
      setStatus('WINDOWS AGENT');
      const result = await waitCommand(id);
      if (result.status !== 'completed') throw new Error(result.error);
      const response = result.response || 'Done.';
      addMessage('assistant', response);
      speak(response);
    }
  } catch (error) {
    const msg = error?.message || String(error);
    state.lastError = msg;
    addMessage('assistant', msg);
    speak(msg);
  } finally {
    setBusy(false);
    setStatus(state.wake ? 'WAKE LISTENING' : 'SYSTEM READY');
    updateLiveUI();
    scrollMessages();
  }
}

async function confirmExecute() {
  const intent = state.confirm;
  state.confirm = null;
  renderApp();
  setBusy(true);
  try {
    const id = await queue(intent);
    const result = await waitCommand(id);
    const msg = result.status === 'completed' ? (result.response || 'Done.') : result.error;
    addMessage('assistant', msg);
    speak(msg);
  } catch (error) {
    addMessage('assistant', error?.message || String(error));
  } finally {
    setBusy(false);
    setStatus('SYSTEM READY');
    updateLiveUI();
  }
}

function ensureRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  if (recognition) return recognition;
  recognition = new SR();
  recognition.lang = 'en-IN';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    state.listening = true;
    state.interim = '';
    setStatus(state.wake ? 'WAKE LISTENING' : 'LISTENING');
    updateLiveUI();
  };

  recognition.onresult = (event) => {
    let finalText = '';
    let interimText = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const transcript = event.results[i][0]?.transcript || '';
      if (event.results[i].isFinal) finalText += `${transcript} `;
      else interimText += `${transcript} `;
    }
    state.interim = interimText.trim();
    updateLiveUI();
    if (finalText.trim()) {
      const command = finalText.trim().replace(/\s+/g, ' ');
      state.interim = command;
      updateLiveUI();
      void submit(command, { fromVoice: true });
    }
  };

  recognition.onerror = (event) => {
    state.listening = false;
    state.interim = '';
    const err = String(event?.error || 'unknown');
    if (err !== 'aborted') setStatus(`VOICE ${err.toUpperCase()}`);
    updateLiveUI();
    if (voiceRequested && (state.wake || voiceMode === 'manual')) scheduleVoiceRestart();
  };

  recognition.onend = () => {
    state.listening = false;
    updateLiveUI();
    if (voiceRequested && (state.wake || voiceMode === 'manual') && !state.speaking) scheduleVoiceRestart();
  };
  return recognition;
}

function startListening() {
  const sr = ensureRecognition();
  if (!sr) {
    setStatus('VOICE NOT SUPPORTED');
    updateLiveUI();
    return;
  }
  voiceRequested = true;
  state.interim = '';
  try {
    if (!state.listening) sr.start();
  } catch {
    scheduleVoiceRestart();
  }
}

function scheduleVoiceRestart() {
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    if (voiceRequested && !state.listening && !state.speaking) startListening();
  }, 500);
}

function stopListening() {
  voiceRequested = false;
  clearTimeout(restartTimer);
  state.interim = '';
  try { recognition?.stop(); } catch { /* ignored */ }
  state.listening = false;
  setStatus(state.wake ? 'WAKE OFF' : 'SYSTEM READY');
  updateLiveUI();
}

function speak(text) {
  if (!('speechSynthesis' in window) || !text) return;
  try { recognition?.stop(); } catch { /* ignored */ }
  state.listening = false;
  state.speaking = true;
  setStatus('JARVIS SPEAKING');
  updateLiveUI();
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(String(text));
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find((v) => /en-IN/i.test(v.lang)) || voices.find((v) => /^en(-US|-GB)?$/i.test(v.lang)) || voices.find((v) => /^en/i.test(v.lang));
  if (preferred) utterance.voice = preferred;
  utterance.rate = 0.98;
  utterance.pitch = 0.95;
  utterance.volume = 1;
  utterance.onend = () => {
    state.speaking = false;
    setStatus(state.wake ? 'WAKE LISTENING' : 'SYSTEM READY');
    updateLiveUI();
    if (state.wake) {
      voiceRequested = true;
      scheduleVoiceRestart();
    }
  };
  utterance.onerror = () => {
    state.speaking = false;
    setStatus(state.wake ? 'WAKE LISTENING' : 'SYSTEM READY');
    updateLiveUI();
    if (state.wake) {
      voiceRequested = true;
      scheduleVoiceRestart();
    }
  };
  window.speechSynthesis.speak(utterance);
}

async function bootstrap() {
  renderLoading();
  try {
    const r = await fetch('/api/config');
    if (!r.ok) throw new Error(`Config HTTP ${r.status}`);
    config = await r.json();
    state.cloud = Boolean(config.cloudConfigured);
    if (config.supabaseUrl && config.supabasePublishableKey) {
      supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      const { data } = await supabase.auth.getSession();
      state.session = data.session;
      if (state.session) await startSession();
      supabase.auth.onAuthStateChange(async (_event, session) => {
        state.session = session;
        if (session) {
          await startSession();
          renderApp();
        } else {
          clearInterval(agentTimer);
          state.messages = [];
          renderAuth();
        }
      });
    }
    if (state.session) renderApp(); else renderAuth();
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
  } catch (error) {
    appEl.innerHTML = `<div class="auth-shell"><div class="auth-card glass"><div class="brand-mark">J.A.R.V.I.S.</div><h1>SETUP ERROR</h1><p>${esc(error.message || String(error))}</p><p class="muted">Check your Vercel environment variables and deployment.</p></div></div>`;
  }
}

bootstrap();
