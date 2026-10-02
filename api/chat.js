const DEFAULT_MODEL = 'google/gemma-4-26b-a4b-it:free';
const DEFAULT_FALLBACKS = ['google/gemma-4-31b-it:free','nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'];
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const key=process.env.OPENROUTER_API_KEY;
  if(!key) return res.status(503).json({error:'OpenRouter is not configured.',fallbackLocal:true});
  let body=req.body; if(typeof body==='string'){try{body=JSON.parse(body)}catch{return res.status(400).json({error:'Invalid JSON'})}}
  const messages=Array.isArray(body?.messages)?body.messages.slice(-14):[]; if(!messages.length)return res.status(400).json({error:'messages[] is required'});
  const model=process.env.OPENROUTER_MODEL||DEFAULT_MODEL;
  const fallbacks=String(process.env.OPENROUTER_FALLBACKS||DEFAULT_FALLBACKS.join(',')).split(',').map(s=>s.trim()).filter(Boolean).filter(m=>m!==model).slice(0,2);
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),18000);
  try{
    const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','X-Title':'JARVIS'},body:JSON.stringify({model,models:fallbacks,messages:[{role:'system',content:'You are JARVIS, a concise desktop AI assistant. Answer directly and factually. Do not claim you can directly control Windows; local PC actions are performed by the Windows agent.'},...messages.map(m=>({role:m.role==='assistant'?'assistant':'user',content:String(m.content||'')}))],temperature:.25,max_tokens:300,provider:{allow_fallbacks:true,sort:'latency'}}),signal:controller.signal});
    const data=await r.json().catch(()=>({}));
    if(r.ok){const text=data?.choices?.[0]?.message?.content?.trim();if(!text)return res.status(503).json({error:'Empty AI response.',fallbackLocal:true});return res.status(200).json({text,model:data?.model||model});}
    if(r.status===429||r.status===408||r.status>=500)return res.status(503).json({error:`Cloud AI unavailable (${r.status}).`,fallbackLocal:true,detail:data?.error?.message||null});
    return res.status(r.status).json({error:data?.error?.message||`OpenRouter HTTP ${r.status}`});
  }catch(e){return res.status(e?.name==='AbortError'?504:502).json({error:e?.name==='AbortError'?'Cloud AI timed out.':(e?.message||'Cloud AI failed.'),fallbackLocal:true});}
  finally{clearTimeout(timer)}
}
