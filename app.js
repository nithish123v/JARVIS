import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parseIntent } from './intent.js';

const appEl = document.getElementById('app');
let supabase = null;
let config = { deviceId: 'home-pc', cloudConfigured: false };
let state = { session:null, messages:[], busy:false, listening:false, wake:false, speaking:false, cloud:false, agent:false, confirm:null, status:'BOOTING' };
let recognition = null, restartTimer = null;
const nowTime = () => new Intl.DateTimeFormat([], {hour:'2-digit', minute:'2-digit'}).format(new Date());

function esc(s){const d=document.createElement('div');d.textContent=String(s??'');return d.innerHTML;}
function addMessage(role,text){state.messages.push({role,text,time:nowTime()});renderMessages();}
function setStatus(s){state.status=s;const e=document.querySelector('[data-status]');if(e)e.textContent=s;}
function setBusy(v){state.busy=v;const e=document.querySelector('[data-send]');if(e)e.disabled=v;}
function renderMessages(){const box=document.querySelector('[data-messages]');if(!box)return;box.innerHTML=state.messages.map(m=>`<div class="msg ${m.role}"><div class="avatar">${m.role==='assistant'?'J':'YOU'}</div><div class="bubble"><div>${esc(m.text)}</div><span>${m.time}</span></div></div>`).join('');box.scrollTop=box.scrollHeight;}

function renderLoading(){appEl.innerHTML='<div class="splash"><div class="splash-ring"></div><div class="splash-title">J.A.R.V.I.S.</div><div class="splash-sub">INITIALIZING CLOUD COMMAND CORE</div></div>';}

function renderAuth(){
  appEl.innerHTML=`<div class="auth-shell"><div class="stars"></div><div class="auth-card glass"><div class="brand-mark">J.A.R.V.I.S.</div><div class="auth-subtitle">GITHUB // VERCEL // SUPABASE // WINDOWS AGENT</div><h1>COMMAND CORE</h1><p class="muted">Sign in to sync AI conversations and send commands to your connected Windows PC.</p>${!supabase?`<div class="warning"><b>Supabase is not configured.</b><br><br>Add <code>SUPABASE_URL</code> and <code>SUPABASE_PUBLISHABLE_KEY</code> to Vercel environment variables, then redeploy.</div>`:''}<form data-auth><input name="email" type="email" placeholder="Email" required><input name="password" type="password" placeholder="Password" required minlength="6"><button class="primary" type="submit" ${!supabase?'disabled':''}>AUTHENTICATE</button></form><button class="text-btn" data-signup>Create account</button><div class="small-note">Device: <b>${esc(config.deviceId)}</b></div></div></div>`;
  document.querySelector('[data-auth]')?.addEventListener('submit',authSubmit);
  document.querySelector('[data-signup]')?.addEventListener('click',signup);
}

function renderApp(){
  appEl.innerHTML=`<div class="app-shell"><div class="scanlines"></div><header class="topbar glass"><div class="brand"><span class="dot"></span>J.A.R.V.I.S.</div><div class="top-status"><span class="pill ${state.cloud?'online':'offline'}">CLOUD <b>${state.cloud?'READY':'FALLBACK'}</b></span><span class="pill ${state.agent?'online':'offline'}" data-agent-pill>PC ${state.agent?'ONLINE':'OFFLINE'}</span><span class="pill" data-status>${state.status}</span></div><button class="ghost" data-signout>SIGN OUT</button></header><main class="layout"><aside class="left-panel glass"><div class="orb-wrap"><div class="orb ${state.listening?'listening':''} ${state.speaking?'speaking':''}"><div class="orb-core"></div><div class="ring r1"></div><div class="ring r2"></div><div class="ring r3"></div></div></div><div class="hud-title">COMMAND CORE</div><div class="telemetry"><div><span>DEVICE</span><b>${esc(config.deviceId)}</b></div><div><span>VOICE</span><b>${state.listening?'LISTENING':'STANDBY'}</b></div><div><span>AI</span><b data-ai>${state.cloud?'OPENROUTER':'OLLAMA FALLBACK'}</b></div></div><button class="wake ${state.wake?'active':''}" data-wake>${state.wake?'WAKE: ON':'WAKE: OFF'}</button><div class="quick-grid"><button data-q="What is the time?">TIME</button><button data-q="Open YouTube">YOUTUBE</button><button data-q="Play a random music video">PLAY</button><button data-q="Take a screenshot">SCREENSHOT</button></div></aside><section class="chat-panel glass"><div class="panel-head"><div><span class="eyebrow">ACTIVITY STREAM</span><h2>JARVIS ONLINE</h2></div><div class="latency">CLOUD + LOCAL COMMAND CHANNEL</div></div><div class="messages" data-messages></div><div class="composer"><button class="mic" data-mic title="Voice">◉</button><textarea data-input rows="1" placeholder="Say or type a command..."></textarea><button class="send" data-send>SEND</button></div><div class="hint">Try: “Play any Taylor Swift song”, “Play the GTA 6 trailer”, “Close this tab”, “Open Chrome”, “Set volume to 40”, “Lock my PC”, or ask any normal question.</div></section></main></div>${state.confirm?`<div class="modal-backdrop"><div class="confirm glass"><div class="eyebrow">SECURITY CHECK</div><h3>${state.confirm.type==='RESTART_PC'?'Restart this PC?':'Shut down this PC?'}</h3><p>This action affects the Windows computer connected to JARVIS.</p><div class="confirm-actions"><button class="ghost" data-cancel>CANCEL</button><button class="danger" data-confirm>CONFIRM</button></div></div></div>`:''}`;
  document.querySelector('[data-signout]')?.addEventListener('click',()=>supabase?.auth.signOut());
  document.querySelector('[data-wake]')?.addEventListener('click',()=>{state.wake=!state.wake;if(state.wake)startListening();else stopListening();renderApp();});
  document.querySelector('[data-mic]')?.addEventListener('click',()=>state.listening?stopListening():startListening());
  document.querySelector('[data-send]')?.addEventListener('click',()=>submit());
  const input=document.querySelector('[data-input]'); input?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submit();}});
  document.querySelectorAll('[data-q]').forEach(b=>b.addEventListener('click',()=>submit(b.dataset.q)));
  document.querySelector('[data-cancel]')?.addEventListener('click',()=>{state.confirm=null;renderApp();});
  document.querySelector('[data-confirm]')?.addEventListener('click',confirmExecute);
  renderMessages();updateAgentPill();
}

async function authSubmit(e){e.preventDefault();if(!supabase)return;const f=new FormData(e.currentTarget);const {data,error}=await supabase.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(error)return alert(error.message);state.session=data.session;await startSession();renderApp();}
async function signup(){if(!supabase)return;const email=prompt('Email:');if(!email)return;const password=prompt('Password (6+ characters):');if(!password)return;const {error}=await supabase.auth.signUp({email,password});alert(error?error.message:'Account created. Check your email if confirmation is enabled.');}

async function startSession(){
  const uid=state.session?.user?.id;if(!uid||!supabase)return;
  const {data}=await supabase.from('chat_messages').select('role,content,created_at').eq('user_id',uid).order('created_at',{ascending:true}).limit(120);
  if(data?.length)state.messages=data.map(m=>({role:m.role,text:m.content,time:nowTime()}));
  await checkAgent();
  setInterval(checkAgent,15000);
}

function updateAgentPill(){const e=document.querySelector('[data-agent-pill]');if(e){e.textContent=state.agent?'PC ONLINE':'PC OFFLINE';e.className=`pill ${state.agent?'online':'offline'}`;}}

async function checkAgent(){
  if(!supabase||!state.session||state.busy)return;
  try{
    const {data,error}=await supabase.from('pc_commands').insert({user_id:state.session.user.id,device_id:config.deviceId,command_type:'PING',payload:{type:'PING'},status:'queued'}).select('id').single();
    if(error)throw error;
    const r=await waitCommand(data.id,4);
    state.agent=r.status==='completed';
  }catch{state.agent=false;}
  updateAgentPill();
}

async function saveChat(role,content){if(supabase&&state.session)await supabase.from('chat_messages').insert({user_id:state.session.user.id,role,content});}
async function queue(intent){if(!supabase||!state.session)throw new Error('Please sign in to use Windows control.');const {data,error}=await supabase.from('pc_commands').insert({user_id:state.session.user.id,device_id:config.deviceId,command_type:intent.type,payload:intent,status:'queued'}).select('id').single();if(error)throw new Error(error.message);return data.id;}
async function waitCommand(id,maxSeconds=30){for(let i=0;i<Math.ceil(maxSeconds/0.8);i++){const {data}=await supabase.from('pc_commands').select('status,response,error').eq('id',id).maybeSingle();if(data&&(data.status==='completed'||data.status==='error'))return data;await new Promise(r=>setTimeout(r,800));}return{status:'error',error:'Windows agent timeout. Start windows-agent/START-JARVIS-AGENT.bat on your PC.'};}
async function cloudChat(prompt){const history=state.messages.slice(-14).map(m=>({role:m.role,content:m.text}));const r=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messages:[...history,{role:'user',content:prompt}]})});const j=await r.json().catch(()=>({}));if(r.ok&&j.text){state.cloud=true;return j.text;}state.cloud=false;if(j.fallbackLocal)return null;throw new Error(j.error||`Cloud AI HTTP ${r.status}`);}

async function submit(forced){const el=document.querySelector('[data-input]');const text=String(forced??el?.value??'').trim();if(!text||state.busy)return;if(el)el.value='';addMessage('user',text);void saveChat('user',text);setBusy(true);setStatus('PROCESSING');const intent=parseIntent(text);
  try{
    if(intent.type==='AI_CHAT'){
      let cloud=null;try{cloud=await cloudChat(text);}catch(e){if(e.message)cloud=null;}
      if(cloud){addMessage('assistant',cloud);void saveChat('assistant',cloud);speak(cloud);}
      else{const id=await queue({type:'AI_CHAT',prompt:text});const r=await waitCommand(id);if(r.status!=='completed')throw new Error(r.error);addMessage('assistant',r.response);void saveChat('assistant',r.response);speak(r.response);}
    }else if(intent.needsConfirm){state.confirm=intent;setBusy(false);setStatus('CONFIRMATION REQUIRED');renderApp();return;}
    else{const id=await queue(intent);setStatus('WINDOWS AGENT');const r=await waitCommand(id);if(r.status!=='completed')throw new Error(r.error);addMessage('assistant',r.response||'Done.');speak(r.response||'Done.');}
  }catch(e){const msg=e?.message||String(e);addMessage('assistant',msg);speak(msg);}
  finally{setBusy(false);setStatus(state.wake?'WAKE LISTENING':'SYSTEM READY');renderApp();}
}

async function confirmExecute(){const intent=state.confirm;state.confirm=null;renderApp();setBusy(true);try{const id=await queue(intent);const r=await waitCommand(id);const msg=r.status==='completed'?(r.response||'Done.'):r.error;addMessage('assistant',msg);speak(msg);}catch(e){addMessage('assistant',e.message);}finally{setBusy(false);setStatus('SYSTEM READY');renderApp();}}

function startListening(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){setStatus('VOICE NOT SUPPORTED — TYPE COMMANDS');return;}if(recognition)return;recognition=new SR();recognition.lang='en-IN';recognition.interimResults=true;recognition.continuous=false;recognition.maxAlternatives=1;recognition.onstart=()=>{state.listening=true;renderApp();setStatus(state.wake?'WAKE LISTENING':'LISTENING');};recognition.onresult=e=>{let s='';for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)s+=e.results[i][0].transcript;if(s.trim())submit(s.trim());};recognition.onerror=e=>{state.listening=false;recognition=null;if(e.error!=='aborted')setStatus(`VOICE: ${e.error}`);if(state.wake)restartListening();};recognition.onend=()=>{state.listening=false;recognition=null;if(state.wake&&!state.speaking)restartListening();else renderApp();};try{recognition.start();}catch{recognition=null;restartListening();}}
function restartListening(){clearTimeout(restartTimer);restartTimer=setTimeout(()=>{if(state.wake&&!state.speaking)startListening();},700);}
function stopListening(){clearTimeout(restartTimer);try{recognition?.stop();}catch{}recognition=null;state.listening=false;renderApp();}
function speak(text){if(!('speechSynthesis'in window)||!text)return;stopListening();window.speechSynthesis.cancel();state.speaking=true;setStatus('JARVIS SPEAKING');const u=new SpeechSynthesisUtterance(text);u.rate=1;u.pitch=.95;u.onend=()=>{state.speaking=false;if(state.wake)restartListening();renderApp();};u.onerror=()=>{state.speaking=false;if(state.wake)restartListening();renderApp();};window.speechSynthesis.speak(u);}

async function bootstrap(){renderLoading();try{const r=await fetch('/api/config');if(!r.ok)throw new Error(`Config HTTP ${r.status}`);config=await r.json();state.cloud=Boolean(config.cloudConfigured);if(config.supabaseUrl&&config.supabasePublishableKey){supabase=createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});const {data}=await supabase.auth.getSession();state.session=data.session;if(state.session)await startSession();supabase.auth.onAuthStateChange(async(_e,s)=>{state.session=s;if(s){await startSession();renderApp();}else{state.messages=[];renderAuth();}});}else{state.session=null;}if(state.session)renderApp();else renderAuth();}catch(e){appEl.innerHTML=`<div class="auth-shell"><div class="auth-card glass"><div class="brand-mark">J.A.R.V.I.S.</div><h1>SETUP ERROR</h1><p>${esc(e.message||String(e))}</p><p class="muted">Deploy this repository to Vercel and add the Supabase environment variables.</p></div></div>`;}}
bootstrap();
