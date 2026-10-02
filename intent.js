const APP_ALIASES = {
  notepad: ['notepad.exe'],
  calculator: ['calc.exe'],
  calc: ['calc.exe'],
  explorer: ['explorer.exe'],
  'file explorer': ['explorer.exe'],
  chrome: ['chrome.exe'],
  'google chrome': ['chrome.exe'],
  edge: ['msedge.exe'],
  'microsoft edge': ['msedge.exe'],
  terminal: ['wt.exe'],
  'windows terminal': ['wt.exe'],
  cmd: ['cmd.exe'],
  'command prompt': ['cmd.exe'],
  powershell: ['powershell.exe'],
  'task manager': ['taskmgr.exe'],
  settings: ['ms-settings:'],
  paint: ['mspaint.exe'],
  vscode: ['code.exe'],
  'vs code': ['code.exe'],
  word: ['winword.exe'],
  excel: ['excel.exe'],
  powerpoint: ['powerpnt.exe'],
  spotify: ['spotify.exe'],
  discord: ['discord.exe'],
  camera: ['microsoft.windows.camera:'],
  photos: ['ms-photos:'],
};

const normalize = (s) => String(s || '')
  .toLowerCase()
  .replace(/[“”]/g, '"')
  .replace(/[’]/g, "'")
  .replace(/\s+/g, ' ')
  .trim();

export function appNameFromText(text) {
  const t = normalize(text);
  return Object.keys(APP_ALIASES)
    .sort((a, b) => b.length - a.length)
    .find(k => t.includes(k)) || null;
}

function stripLead(s) {
  return s
    .replace(/^(?:please\s+)?(?:can\s+you\s+|could\s+you\s+|would\s+you\s+|will\s+you\s+|can\s+u\s+|could\s+u\s+)?/i, '')
    .trim();
}

function cleanQuery(q) {
  return String(q || '')
    .replace(/^[\s:,-]+|[\s:,-]+$/g, '')
    .replace(/\b(?:song|video|music|track)\s*$/i, '')
    .trim();
}

export function parseIntent(input) {
  const raw = String(input || '').trim();
  const t = normalize(raw);
  if (!t) return { type: 'EMPTY' };

  // Time — deliberately supports natural speech such as:
  // "what's the time now", "what time is it", "tell me the current time".
  if (
    /^(?:what(?:'s| is)\s+(?:the\s+)?(?:current\s+)?time(?:\s+now)?|what\s+time\s+is\s+it(?:\s+now)?|what\s+time\s+is\s+it\s+right\s+now|tell\s+me\s+(?:the\s+)?(?:current\s+)?time(?:\s+now)?|can\s+you\s+(?:tell\s+me\s+)?(?:the\s+)?(?:current\s+)?time(?:\s+now)?|current\s+time)\??$/i.test(t)
  ) return { type: 'GET_TIME' };

  if (
    /^(?:what(?:'s| is)\s+(?:today'?s\s+)?(?:the\s+)?(?:current\s+)?date|what\s+(?:date|day)\s+is\s+it(?:\s+today|\s+right\s+now)?|tell\s+me\s+(?:today'?s\s+)?(?:the\s+)?(?:current\s+)?date|today'?s\s+date|current\s+date)\??$/i.test(t)
    || /\btoday'?s\s+date\b/i.test(t)
  ) return { type: 'GET_DATE' };

  if (
    /^(?:what\s+year\s+(?:is\s+it|are\s+we\s+in)(?:\s+now)?|which\s+year\s+is\s+it|tell\s+me\s+the\s+(?:current\s+)?year|current\s+year|year)\??$/i.test(t)
  ) return { type: 'GET_YEAR' };

  if (/\b(?:screenshot|screen shot|capture (?:my|the) screen|take (?:a )?screenshot)\b/i.test(t)) return { type: 'SCREENSHOT' };
  if (/\b(?:lock|lock my|lock the)\s+(?:pc|computer|laptop|windows)\b/i.test(t) || t === 'lock pc') return { type: 'LOCK_PC' };
  if (/\b(?:restart|reboot)\s+(?:my\s+)?(?:pc|computer|laptop|windows)\b/i.test(t)) return { type: 'RESTART_PC', needsConfirm: true };
  if (/\b(?:shutdown|shut down|power off|turn off)\s+(?:my\s+)?(?:pc|computer|laptop|windows)\b/i.test(t)) return { type: 'SHUTDOWN_PC', needsConfirm: true };

  // Audio controls.
  if (/^(?:mute|mute volume|silence|mute the volume)\b/i.test(t)) return { type: 'VOLUME_MUTE' };
  if (/\b(?:volume\s+(?:up|increase|higher|louder)|turn\s+(?:the\s+)?volume\s+up|increase\s+(?:the\s+)?volume)\b/i.test(t)) return { type: 'VOLUME_UP' };
  if (/\b(?:volume\s+(?:down|decrease|lower|quieter)|turn\s+(?:the\s+)?volume\s+down|decrease\s+(?:the\s+)?volume)\b/i.test(t)) return { type: 'VOLUME_DOWN' };
  const vol = t.match(/\b(?:set\s+)?volume\s+(?:to\s+)?(\d{1,3})\s*%?/i);
  if (vol) return { type: 'SET_VOLUME', value: Math.max(0, Math.min(100, Number(vol[1]))) };

  if (/\b(?:brightness\s+(?:up|increase|higher|brighter)|make\s+(?:the\s+)?screen\s+brighter|increase\s+(?:the\s+)?brightness)\b/i.test(t)) return { type: 'BRIGHTNESS_UP' };
  if (/\b(?:brightness\s+(?:down|decrease|lower|dimmer)|make\s+(?:the\s+)?screen\s+dimmer|decrease\s+(?:the\s+)?brightness)\b/i.test(t)) return { type: 'BRIGHTNESS_DOWN' };
  const bright = t.match(/\b(?:set\s+)?brightness\s+(?:to\s+)?(\d{1,3})\s*%?/i);
  if (bright) return { type: 'SET_BRIGHTNESS', value: Math.max(0, Math.min(100, Number(bright[1]))) };

  // Media transport controls.
  if (/\b(?:previous|previous song|previous track|go back)\b/.test(t) && /\b(?:song|track|media)\b/.test(t)) return { type: 'MEDIA_PREVIOUS' };
  if (/\b(?:next|next song|next track|skip)\b/.test(t) && /\b(?:song|track|media)\b/.test(t)) return { type: 'MEDIA_NEXT' };
  if (/^(?:play|pause|play or pause|toggle play|pause music|pause media)$/i.test(t) || /\b(?:play\/pause|toggle play|pause the music|pause the video)\b/i.test(t)) return { type: 'MEDIA_TOGGLE' };

  // Browser/tab controls — before generic close handling.
  if (/\b(?:close|exit|quit)\s+(?:this|the|current)?\s*(?:browser\s+)?tab\b/i.test(t) || t === 'close tab' || t === 'close this') return { type: 'CLOSE_TAB' };
  if (/\b(?:close|exit|quit)\s+(?:youtube|youtube tab|this youtube)\b/i.test(t)) return { type: 'CLOSE_TAB' };
  if (/^(?:close|exit|quit)\s+(?:it|this window|the current window|current window)$/i.test(t)) return { type: 'CLOSE_WINDOW' };

  // YouTube/media playback. Supports arbitrary songs, artists and videos.
  const naturalPlay = t.match(/^(?:please\s+)?(?:can\s+you\s+|could\s+you\s+|would\s+you\s+|will\s+you\s+)?open\s+youtube\s+(?:and\s+)?play\s+(.+?)[.!?]?$/i);
  if (naturalPlay) {
    const q = cleanQuery(naturalPlay[1]);
    if (q) return { type: 'PLAY_YOUTUBE', query: q };
  }

  const youtubePlay = t.match(/^(?:please\s+)?(?:can\s+you\s+|could\s+you\s+|would\s+you\s+|will\s+you\s+)?(?:play|start|put\s+on)\s+(.+?)(?:\s+(?:on|in)\s+youtube)?[.!?]?$/i);
  if (youtubePlay) {
    const q = cleanQuery(youtubePlay[1]);
    if (q && !/^(?:pause|play|music|media)$/i.test(q)) return { type: 'PLAY_YOUTUBE', query: q };
  }

  const searchYoutube = t.match(/^(?:search|find|look\s+up)\s+(?:youtube\s+for|on\s+youtube)\s+(.+)$/i);
  if (searchYoutube) return { type: 'SEARCH_YOUTUBE', query: searchYoutube[1].trim() };
  if (/\bopen youtube\b/i.test(t) || t === 'youtube') return { type: 'OPEN_URL', url: 'https://www.youtube.com/' };

  const search = t.match(/^(?:search|google|look up)\s+(?:google\s+for\s+)?(.+)$/i) || t.match(/\bsearch google for\s+(.+)$/i);
  if (search) return { type: 'SEARCH_WEB', query: search[1].trim() };

  const weather = t.match(/^(?:weather|what(?:'s| is)\s+the\s+weather)(?:\s+(?:in|at|for)\s+(.+))?\??$/i);
  if (weather) return { type: 'WEATHER', city: weather[1]?.trim() || null };

  // Windows applications / URLs.
  const open = stripLead(t).match(/^open\s+(.+?)[.!?]?$/i);
  if (open) {
    const target = open[1].trim();
    const app = appNameFromText(target);
    if (app) return { type: 'OPEN_APP', app };
    if (/^https?:\/\//i.test(target)) return { type: 'OPEN_URL', url: target };
    if (/^(?:www\.)?[-\w]+\.[a-z]{2,}$/i.test(target)) return { type: 'OPEN_URL', url: `https://${target}` };
    return { type: 'OPEN_TARGET', target };
  }

  const close = stripLead(t).match(/^(?:close|exit|quit)\s+(.+?)[.!?]?$/i);
  if (close) {
    const target = close[1].trim();
    const app = appNameFromText(target);
    if (app) return { type: 'CLOSE_APP', app };
    if (/youtube|tab|browser/i.test(target)) return { type: 'CLOSE_TAB' };
    return { type: 'CLOSE_TARGET', target };
  }

  const calc = t.match(/^(?:calculate|calc|what is)\s+([0-9+\-*/().%\s^]+)$/i);
  if (calc) return { type: 'CALCULATE', expression: calc[1].replace(/\^/g, '**') };
  if (/\b(?:system info|pc status|computer status|cpu usage|gpu usage|system status)\b/i.test(t)) return { type: 'SYSTEM_INFO' };

  return { type: 'AI_CHAT', prompt: raw };
}
