#!/usr/bin/env python3
from __future__ import annotations
import datetime as dt, json, os, re, shutil, subprocess, sys, time, urllib.error, urllib.parse, urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parent

def load_env(path):
    if not path.exists(): return
    for line in path.read_text(encoding='utf-8').splitlines():
        line=line.strip()
        if not line or line.startswith('#') or '=' not in line: continue
        k,v=line.split('=',1); os.environ.setdefault(k.strip(),v.strip().strip('"').strip("'"))
load_env(ROOT/'.env')
SUPABASE_URL=os.getenv('SUPABASE_URL','').rstrip('/')
SUPABASE_SERVICE_ROLE_KEY=os.getenv('SUPABASE_SERVICE_ROLE_KEY','')
DEVICE_ID=os.getenv('JARVIS_DEVICE_ID','home-pc')
OLLAMA_URL=os.getenv('OLLAMA_URL','http://127.0.0.1:11434').rstrip('/')
OLLAMA_MODEL=os.getenv('OLLAMA_MODEL','qwen2.5:3b')
WEATHER_CITY=os.getenv('JARVIS_WEATHER_CITY','Coimbatore')
POLL_SECONDS=float(os.getenv('POLL_SECONDS','1.0'))
APPS={
 'notepad':('notepad.exe','notepad.exe'),'calculator':('calc.exe','CalculatorApp.exe'),'calc':('calc.exe','CalculatorApp.exe'),
 'explorer':('explorer.exe','explorer.exe'),'file explorer':('explorer.exe','explorer.exe'),'chrome':('chrome.exe','chrome.exe'),
 'google chrome':('chrome.exe','chrome.exe'),'edge':('msedge.exe','msedge.exe'),'microsoft edge':('msedge.exe','msedge.exe'),
 'terminal':('wt.exe','WindowsTerminal.exe'),'windows terminal':('wt.exe','WindowsTerminal.exe'),'cmd':('cmd.exe','cmd.exe'),
 'command prompt':('cmd.exe','cmd.exe'),'powershell':('powershell.exe','powershell.exe'),'task manager':('taskmgr.exe','Taskmgr.exe'),
 'paint':('mspaint.exe','mspaint.exe'),'vscode':('code.exe','Code.exe'),'vs code':('code.exe','Code.exe'),'word':('winword.exe','WINWORD.EXE'),
 'excel':('excel.exe','EXCEL.EXE'),'powerpoint':('powerpnt.exe','POWERPNT.EXE'),'spotify':('spotify.exe','Spotify.exe'),'discord':('discord.exe','Discord.exe')}

def now_iso():return dt.datetime.now(dt.timezone.utc).isoformat()
def sb(method,path,body=None,params=None):
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY: raise RuntimeError('Supabase URL/service-role key missing in windows-agent/.env')
    url=SUPABASE_URL+path+('?' + urllib.parse.urlencode(params) if params else '')
    req=urllib.request.Request(url,data=None if body is None else json.dumps(body).encode(),method=method)
    req.add_header('apikey',SUPABASE_SERVICE_ROLE_KEY);req.add_header('Authorization','Bearer '+SUPABASE_SERVICE_ROLE_KEY);req.add_header('Content-Type','application/json');req.add_header('Prefer','return=representation,resolution=merge-duplicates')
    try:
        with urllib.request.urlopen(req,timeout=12) as r:
            raw=r.read().decode();return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:raise RuntimeError(f'Supabase HTTP {e.code}: {e.read().decode(errors="replace")[:350]}')

def ps(cmd,timeout=12):
    exe=shutil.which('powershell.exe') or shutil.which('powershell')
    if not exe:raise RuntimeError('Windows PowerShell was not found.')
    p=subprocess.run([exe,'-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',cmd],capture_output=True,text=True,timeout=timeout,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    if p.returncode!=0:raise RuntimeError(p.stderr.strip() or f'PowerShell exited {p.returncode}')
    return p.stdout.strip()

def detached(exe,*args):
    flags=getattr(subprocess,'DETACHED_PROCESS',0)|getattr(subprocess,'CREATE_NO_WINDOW',0)
    subprocess.Popen([exe,*args],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,stdin=subprocess.DEVNULL,creationflags=flags,close_fds=True)

def open_target(target):
    target=target.strip()
    if re.match(r'^https?://',target,re.I):os.startfile(target);return target
    if re.match(r'^(www\.)?[-\w]+\.[a-z]{2,}$',target,re.I):url='https://'+target;os.startfile(url);return url
    raise RuntimeError(f'I cannot open "{target}" as an app or URL.')

def open_app(app):
    key=app.lower()
    if key not in APPS:return open_target(app)
    exe,_=APPS[key];run=exe not in ('ms-settings:','microsoft.windows.camera:','ms-photos:')
    if run:detached(exe)
    else:os.startfile(exe)
    return f'Opening {key}.'

def close_app(app):
    key=app.lower()
    if key in ('explorer','file explorer'):
        ps("$sh=New-Object -ComObject Shell.Application; $sh.Windows() | ForEach-Object { $_.Quit() }");return 'Closed File Explorer windows.'
    if key not in APPS:raise RuntimeError(f'No Windows process mapping for {app}.')
    proc=APPS[key][1]
    ps(f"Get-Process -Name '{Path(proc).stem}' -ErrorAction SilentlyContinue | Stop-Process -Force")
    return f'Closed {key}.'

def vk(vk):
    code=int(vk,16)
    cmd=f'''Add-Type @"\nusing System; using System.Runtime.InteropServices; public static class Key {{ [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo); }}\n"@; [Key]::keybd_event({code},0,0,[UIntPtr]::Zero); [Key]::keybd_event({code},0,2,[UIntPtr]::Zero)'''
    ps(cmd)

def media_key(name):{'MEDIA_TOGGLE':'B3','MEDIA_NEXT':'B0','MEDIA_PREVIOUS':'B1','VOLUME_UP':'AF','VOLUME_DOWN':'AE'}[name] and vk({'MEDIA_TOGGLE':'B3','MEDIA_NEXT':'B0','MEDIA_PREVIOUS':'B1','VOLUME_UP':'AF','VOLUME_DOWN':'AE'}[name])

def volume_set(percent):
    percent=max(0,min(100,int(percent)))
    cmd=f'''Add-Type @"\nusing System; using System.Runtime.InteropServices; [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface V {{ int a();int b();int c();int d();int e();int f();int g();int h();int i();int Set(float x,Guid g);int j();int Get(out float x);int k();int l();int m();int Mute([MarshalAs(UnmanagedType.Bool)]bool x,Guid g);int GetMute(out bool x); }} [Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface E {{ int a(); int GetDefaultAudioEndpoint(int x,int y,out D d); }} [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface D {{ int a(); int Activate(ref Guid x,uint c,IntPtr p,out V v); }}\n"@; $e=[Activator]::CreateInstance([type]::GetTypeFromCLSID([Guid]'BCDE0395-E52F-467C-8E3D-C4579291692E'));$d=$null;[void]$e.GetDefaultAudioEndpoint(0,1,[ref]$d);$iid=[Guid]'5CDF2C82-841E-4546-9722-0CF74078229A';$v=$null;[void]$d.Activate([ref]$iid,23,[IntPtr]::Zero,[ref]$v);[void]$v.Set({percent/100.0},[Guid]::Empty)'''
    ps(cmd)

def mute_toggle():
    cmd='''Add-Type @"\nusing System; using System.Runtime.InteropServices; [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface V {{ int a();int b();int c();int d();int e();int f();int g();int h();int i();int Set(float x,Guid g);int j();int Get(out float x);int k();int l();int m();int Mute([MarshalAs(UnmanagedType.Bool)]bool x,Guid g);int GetMute(out bool x); }}\n"@; $e=[Activator]::CreateInstance([type]::GetTypeFromCLSID([Guid]'BCDE0395-E52F-467C-8E3D-C4579291692E'))'''
    # Keep the reliable Windows media mute key for compatibility.
    vk('AD')

def brightness(delta=None,value=None):
    cur=int(ps("Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness -ErrorAction Stop | Select-Object -First 1 -ExpandProperty CurrentBrightness"))
    target=max(0,min(100,int(value) if value is not None else cur+int(delta)))
    ps(f"Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods -ErrorAction Stop | Invoke-CimMethod -MethodName WmiSetBrightness -Arguments @{{Timeout=0;Brightness={target}}} | Out-Null");return target

def screenshot():
    out=Path.home()/'Pictures'/'Screenshots';out.mkdir(parents=True,exist_ok=True);path=out/f"JARVIS-{dt.datetime.now():%Y%m%d-%H%M%S}.png"
    q=str(path).replace("'","''")
    ps(f'''Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bmp=New-Object System.Drawing.Bitmap($b.Width,$b.Height); $g=[System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size); $bmp.Save('{q}',[System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose()''',20);return str(path)

def system_info():
    s=ps('$o=Get-CimInstance Win32_OperatingSystem;$c=(Get-CimInstance Win32_Processor|Select-Object -First 1 -ExpandProperty Name);$g=(Get-CimInstance Win32_VideoController|Select-Object -First 1 -ExpandProperty Name);$t=[math]::Round($o.TotalVisibleMemorySize/1MB,1);$f=[math]::Round($o.FreePhysicalMemory/1MB,1);"OS: $($o.Caption)`nCPU: $c`nRAM: $f GB free / $t GB`nGPU: $g"',15)
    n=shutil.which('nvidia-smi');
    if n:
        try:
            g=subprocess.run([n,'--query-gpu=name,utilization.gpu,memory.used,memory.total','--format=csv,noheader,nounits'],capture_output=True,text=True,timeout=8).stdout.strip()
            if g:s+='\nNVIDIA: '+g
        except Exception:pass
    return s

def weather(city=None):
    city=city or WEATHER_CITY
    with urllib.request.urlopen('https://geocoding-api.open-meteo.com/v1/search?name='+urllib.parse.quote(city)+'&count=1&language=en&format=json',timeout=10) as r:g=json.loads(r.read().decode())
    x=(g.get('results') or [None])[0]
    if not x:raise RuntimeError(f'Could not find {city}.')
    url=f"https://api.open-meteo.com/v1/forecast?latitude={x['latitude']}&longitude={x['longitude']}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m&timezone=auto"
    with urllib.request.urlopen(url,timeout=10) as r:d=json.loads(r.read().decode())
    c=d['current'];return f"{city}: {c['temperature_2m']}°C, feels like {c['apparent_temperature']}°C, humidity {c['relative_humidity_2m']}%, wind {c['wind_speed_10m']} km/h."

def youtube_url(query):
    search='https://www.youtube.com/results?search_query='+urllib.parse.quote_plus(query)
    try:
        req=urllib.request.Request(search,headers={'User-Agent':'Mozilla/5.0 JARVIS'})
        with urllib.request.urlopen(req,timeout=12) as r:html=r.read().decode(errors='ignore')
        m=re.search(r'"videoRenderer":\{"videoId":"([\w-]{11})"',html) or re.search(r'"videoId":"([\w-]{11})"',html)
        if m:return 'https://www.youtube.com/watch?v='+m.group(1),False
    except Exception:pass
    return search,True

def play_youtube(query):
    url,search_only=youtube_url(query);os.startfile(url)
    return (f'Opening YouTube search for {query}. Select a video to play.' if search_only else f'Playing {query} on YouTube.')

def calc(expression):
    if not re.fullmatch(r'[0-9+\-*/().%\s*]+',expression):raise RuntimeError('Calculator accepts numbers and + - * / % ( ).')
    return f"Result: {eval(expression,{'__builtins__':{}},{})}"

def ollama(prompt):
    body=json.dumps({'model':OLLAMA_MODEL,'stream':False,'messages':[{'role':'system','content':'You are JARVIS, a concise local Windows assistant. Answer directly.'},{'role':'user','content':prompt}]}).encode()
    req=urllib.request.Request(OLLAMA_URL+'/api/chat',data=body,method='POST',headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=45) as r:d=json.loads(r.read().decode())
    return d.get('message',{}).get('content','').strip() or 'Ollama returned no response.'

def execute(c):
    t=str(c.get('command_type') or c.get('type') or '').upper();p=c.get('payload') or c
    if t=='PING':return 'Windows agent online.'
    if t=='GET_TIME':return dt.datetime.now().astimezone().strftime('The current time is %I:%M %p.')
    if t=='GET_DATE':return dt.datetime.now().astimezone().strftime('Today is %A, %d %B %Y.')
    if t=='GET_YEAR':return f"The current year is {dt.datetime.now().astimezone().year}."
    if t=='OPEN_APP':return open_app(p.get('app',''))
    if t=='CLOSE_APP':return close_app(p.get('app',''))
    if t=='OPEN_URL':os.startfile(p.get('url'));return f"Opening {p.get('url')}."
    if t=='OPEN_TARGET':return open_target(p.get('target',''))
    if t=='CLOSE_TAB':ps("(New-Object -ComObject WScript.Shell).SendKeys('^w')");return 'Closed the current browser tab.'
    if t=='CLOSE_WINDOW':ps("(New-Object -ComObject WScript.Shell).SendKeys('%{F4}')");return 'Closed the active window.'
    if t=='SEARCH_WEB':os.startfile('https://www.google.com/search?q='+urllib.parse.quote_plus(p.get('query','')));return f"Searching Google for {p.get('query')}."
    if t=='SEARCH_YOUTUBE':os.startfile('https://www.youtube.com/results?search_query='+urllib.parse.quote_plus(p.get('query','')));return f"Searching YouTube for {p.get('query')}."
    if t=='PLAY_YOUTUBE':return play_youtube(p.get('query',''))
    if t=='MEDIA_TOGGLE':media_key('MEDIA_TOGGLE');return 'Toggled play/pause.'
    if t=='MEDIA_NEXT':media_key('MEDIA_NEXT');return 'Next track.'
    if t=='MEDIA_PREVIOUS':media_key('MEDIA_PREVIOUS');return 'Previous track.'
    if t=='VOLUME_UP':media_key('VOLUME_UP');return 'Volume up.'
    if t=='VOLUME_DOWN':media_key('VOLUME_DOWN');return 'Volume down.'
    if t=='VOLUME_MUTE':mute_toggle();return 'Mute toggled.'
    if t=='SET_VOLUME':volume_set(p.get('value',50));return f"Volume set to {int(p.get('value',50))}%."
    if t=='BRIGHTNESS_UP':return f"Brightness set to {brightness(10)}%."
    if t=='BRIGHTNESS_DOWN':return f"Brightness set to {brightness(-10)}%."
    if t=='SET_BRIGHTNESS':return f"Brightness set to {brightness(value=p.get('value',50))}%."
    if t=='SCREENSHOT':return f"Screenshot saved to {screenshot()}."
    if t=='LOCK_PC':ps('rundll32.exe user32.dll,LockWorkStation');return 'PC locked.'
    if t=='RESTART_PC':subprocess.run(['shutdown','/r','/t','2','/d','p:0:0'],creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0));return 'PC restart initiated.'
    if t=='SHUTDOWN_PC':subprocess.run(['shutdown','/s','/t','2','/d','p:0:0'],creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0));return 'PC shutdown initiated.'
    if t=='WEATHER':return weather(p.get('city'))
    if t=='CALCULATE':return calc(p.get('expression',''))
    if t=='SYSTEM_INFO':return system_info()
    if t=='AI_CHAT':return ollama(p.get('prompt',''))
    raise RuntimeError(f'Unknown command type: {t}')

def process_rows():
    rows=sb('GET','/rest/v1/pc_commands',params={'select':'*','device_id':f'eq.{DEVICE_ID}','status':'eq.queued','order':'created_at.asc','limit':'5'}) or []
    for row in rows:
        cid=row['id']
        try:
            sb('PATCH','/rest/v1/pc_commands',{'status':'running','started_at':now_iso()},{'id':f'eq.{cid}','status':'eq.queued'})
            out=execute(row)
            sb('PATCH','/rest/v1/pc_commands',{'status':'completed','response':out,'completed_at':now_iso()},{'id':f'eq.{cid}'})
        except Exception as e:
            try:sb('PATCH','/rest/v1/pc_commands',{'status':'error','error':str(e),'completed_at':now_iso()},{'id':f'eq.{cid}'})
            except Exception:pass

def self_test():
    print('[PASS] time:',execute({'type':'GET_TIME'}));print('[PASS] date:',execute({'type':'GET_DATE'}));print('[PASS] year:',execute({'type':'GET_YEAR'}));print('[PASS] calc:',execute({'type':'CALCULATE','expression':'2+2*5'}));print('[PASS] core loaded')

def main():
    if '--self-test' in sys.argv:self_test();return
    if os.name!='nt':raise SystemExit('Run this agent on Windows.')
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:raise SystemExit('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in windows-agent/.env')
    print(f'JARVIS Windows Agent | device={DEVICE_ID} | ollama={OLLAMA_MODEL}')
    while True:
        try:process_rows()
        except Exception as e:print('[WARN]',e)
        time.sleep(POLL_SECONDS)
if __name__=='__main__':main()
