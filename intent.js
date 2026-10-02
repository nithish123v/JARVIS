const APP_ALIASES = {
  notepad: ['notepad.exe'], calculator: ['calc.exe'], calc: ['calc.exe'],
  explorer: ['explorer.exe'], 'file explorer': ['explorer.exe'],
  chrome: ['chrome.exe'], 'google chrome': ['chrome.exe'], edge: ['msedge.exe'], 'microsoft edge': ['msedge.exe'],
  terminal: ['wt.exe'], 'windows terminal': ['wt.exe'], cmd: ['cmd.exe'], 'command prompt': ['cmd.exe'],
  powershell: ['powershell.exe'], 'task manager': ['taskmgr.exe'], settings: ['ms-settings:'], paint: ['mspaint.exe'],
  vscode: ['code.exe'], 'vs code': ['code.exe'], word: ['winword.exe'], excel: ['excel.exe'], powerpoint: ['powerpnt.exe'],
  spotify: ['spotify.exe'], discord: ['discord.exe'], camera: ['microsoft.windows.camera:'], photos: ['ms-photos:'],
};

const normalize = (s) => String(s || '').toLowerCase().replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
export function appNameFromText(text) {
  const t = normalize(text);
  return Object.keys(APP_ALIASES).sort((a,b)=>b.length-a.length).find(k => t.includes(k)) || null;
}
function stripLead(s) { return s.replace(/^(please\s+)?(can you\s+|could you\s+|would you\s+)?/i, '').trim(); }

export function parseIntent(input) {
  const raw = String(input || '').trim();
  const t = normalize(raw);
  if (!t) return { type:'EMPTY' };

  if (/^(what(?:'s| is)\s+)?(the\s+)?(current\s+)?time\??$/.test(t) || /tell me (the )?time/.test(t)) return {type:'GET_TIME'};
  if (/\b(today'?s|today is|current)\s+(date|day)\b/.test(t) || /^date\??$/.test(t)) return {type:'GET_DATE'};
  if (/\bwhat year (is it|are we in)\b/.test(t) || /^year\??$/.test(t)) return {type:'GET_YEAR'};
  if (/\b(screenshot|screen shot|capture my screen)\b/.test(t)) return {type:'SCREENSHOT'};
  if (/\b(lock|lock my|lock the)\s+(pc|computer|laptop|windows)\b/.test(t) || t === 'lock pc') return {type:'LOCK_PC'};
  if (/\b(restart|reboot) (my )?(pc|computer|laptop)\b/.test(t)) return {type:'RESTART_PC', needsConfirm:true};
  if (/\b(shutdown|shut down|power off) (my )?(pc|computer|laptop)\b/.test(t)) return {type:'SHUTDOWN_PC', needsConfirm:true};

  if (/^(mute|mute volume|silence)\b/.test(t)) return {type:'VOLUME_MUTE'};
  if (/\bvolume\s+(up|increase|higher|louder)\b/.test(t) || /\bturn (the )?volume up\b/.test(t)) return {type:'VOLUME_UP'};
  if (/\bvolume\s+(down|decrease|lower|quieter)\b/.test(t) || /\bturn (the )?volume down\b/.test(t)) return {type:'VOLUME_DOWN'};
  const vol = t.match(/\bvolume\s+(?:to\s+)?(\d{1,3})\s*%?/); if (vol) return {type:'SET_VOLUME',value:Math.max(0,Math.min(100,Number(vol[1])))};
  if (/\bbrightness\s+(up|increase|higher|brighter)\b/.test(t) || /\bmake (the )?screen brighter\b/.test(t)) return {type:'BRIGHTNESS_UP'};
  if (/\bbrightness\s+(down|decrease|lower|dimmer)\b/.test(t) || /\bmake (the )?screen dimmer\b/.test(t)) return {type:'BRIGHTNESS_DOWN'};
  const bright=t.match(/\bbrightness\s+(?:to\s+)?(\d{1,3})\s*%?/); if(bright)return{type:'SET_BRIGHTNESS',value:Math.max(0,Math.min(100,Number(bright[1])))};

  if (/\b(previous|previous song|go back)\b/.test(t) && /\b(song|track|media)\b/.test(t)) return {type:'MEDIA_PREVIOUS'};
  if (/\b(next|next song|skip)\b/.test(t) && /\b(song|track|media)\b/.test(t)) return {type:'MEDIA_NEXT'};
  if (/^(play|pause|play or pause|toggle play)\b$/.test(t) || /\b(play\/pause|toggle play)\b/.test(t)) return {type:'MEDIA_TOGGLE'};

  if (/\b(close|exit|quit)\s+(this|current|the)?\s*(browser )?tab\b/.test(t) || t === 'close tab' || t === 'close this') return {type:'CLOSE_TAB'};
  if (/\b(close|exit)\s+(youtube|youtube tab|this youtube)\b/.test(t)) return {type:'CLOSE_TAB'};
  if (/\b(close|exit)\s+(it|this window|current window)\b/.test(t)) return {type:'CLOSE_WINDOW'};

  const naturalPlay = t.match(/^(?:please\s+)?(?:can you\s+|could you\s+|would you\s+)?open youtube and play (.+?)[.!?]?$/i);
  if (naturalPlay) return {type:'PLAY_YOUTUBE',query:naturalPlay[1].replace(/\b(song|video|music)\b$/i,'').trim()};
  const play = t.match(/^(?:please\s+)?(?:can you\s+|could you\s+|would you\s+)?(?:play|start)\s+(.+?)(?:\s+(?:on|in)\s+youtube)?[.!?]?$/i);
  if (play) {
    const q=play[1].replace(/\b(song|video|music)\b$/i,'').trim();
    if(q && !/^(pause|play|music|media)$/.test(q)) return {type:'PLAY_YOUTUBE',query:q};
  }
  if (/\bopen youtube\b/.test(t) || t === 'youtube') return {type:'OPEN_URL',url:'https://www.youtube.com/'};

  const search = t.match(/^(?:search|google|look up)\s+(?:google\s+for\s+)?(.+)$/i) || t.match(/\bsearch google for\s+(.+)$/i);
  if(search) return {type:'SEARCH_WEB',query:search[1].trim()};
  const weather=t.match(/^(?:weather|what(?:'s| is) the weather)(?:\s+(?:in|at)\s+(.+))?\??$/i); if(weather)return{type:'WEATHER',city:weather[1]?.trim()||null};

  const open=stripLead(t).match(/^open\s+(.+?)[.!?]?$/i);
  if(open){const target=open[1].trim();const app=appNameFromText(target);if(app)return{type:'OPEN_APP',app};if(/^https?:\/\//i.test(target))return{type:'OPEN_URL',url:target};if(/^(www\.)?[-\w]+\.[a-z]{2,}$/i.test(target))return{type:'OPEN_URL',url:`https://${target}`};return{type:'OPEN_TARGET',target};}
  const close=stripLead(t).match(/^(?:close|exit|quit)\s+(.+?)[.!?]?$/i);
  if(close){const target=close[1].trim();const app=appNameFromText(target);if(app)return{type:'CLOSE_APP',app};if(/youtube|tab|browser/.test(target))return{type:'CLOSE_TAB'};return{type:'CLOSE_TARGET',target};}

  const calc=t.match(/^(?:calculate|calc|what is)\s+([0-9+\-*/().%\s^]+)$/i);if(calc)return{type:'CALCULATE',expression:calc[1].replace(/\^/g,'**')};
  if(/\b(system info|pc status|computer status|cpu usage|gpu usage)\b/.test(t))return{type:'SYSTEM_INFO'};

  return {type:'AI_CHAT',prompt:raw};
}
