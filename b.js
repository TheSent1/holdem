/* ---------- link encoding (compressed + scrambled so cards aren't readable in the URL) ---------- */
const KEY='pocket-holdem-v1';
function scramble(bytes){
  let h=2166136261; for(const ch of KEY) h=Math.imul(h^ch.charCodeAt(0),16777619);
  let x=(h>>>0)||1; const out=new Uint8Array(bytes.length);
  for(let i=0;i<bytes.length;i++){ x^=x<<13; x>>>=0; x^=x>>>17; x^=x<<5; x>>>=0; out[i]=bytes[i]^(x&255); }
  return out;
}
function toB64(u){ let s=''; for(let i=0;i<u.length;i++) s+=String.fromCharCode(u[i]); return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function fromB64(t){ t=t.replace(/-/g,'+').replace(/_/g,'/'); while(t.length%4) t+='='; const s=atob(t); const u=new Uint8Array(s.length); for(let i=0;i<s.length;i++) u[i]=s.charCodeAt(i); return u; }
async function pipe(u,stream){ return new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(stream)).arrayBuffer()); }
async function encode(state){
  const raw = new TextEncoder().encode(JSON.stringify(state));
  let body=null, flag=0;
  if('CompressionStream' in window){ try{ body=await pipe(raw,new CompressionStream('deflate-raw')); flag=1; }catch(e){ body=null; } }
  if(!body){ body=raw; flag=0; }
  const out=new Uint8Array(body.length+1); out[0]=flag; out.set(scramble(body),1);
  return toB64(out);
}
async function decode(code){
  const u=fromB64(code); let body=scramble(u.slice(1));
  if(u[0]===1) body=await pipe(body,new DecompressionStream('deflate-raw'));
  const s=JSON.parse(new TextDecoder().decode(body));
  if(!s || s.v!==1 || typeof s.id!=='string') throw new Error('bad');
  return s;
}
const baseUrl = () => PUBLIC_URL || (location.origin + location.pathname);
const linkFor = code => baseUrl() + '#g=' + code;

/* ---------- storage ---------- */
const LS={get(k){try{return localStorage.getItem(k)}catch(e){return null}}, set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
function games(){ try{ return JSON.parse(LS.get('hx_games')||'[]'); }catch(e){ return []; } }
function remember(s,code,seat){
  LS.set('hx_seq_'+s.id, s.seq); LS.set('hx_code_'+s.id, code); LS.set('hx_seat_'+s.id, seat);
  const opp = s.names[1-seat] || 'Waiting for friend';
  const list = games().filter(g=>g.id!==s.id);
  list.unshift({id:s.id, opp, ts:Date.now(), over:s.status==='over'});
  LS.set('hx_games', JSON.stringify(list.slice(0,8)));
}

/* ---------- ui helpers ---------- */
const app=document.getElementById('app');
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function cardHTML(c,cls=''){
  if(c==='back') return `<div class="card back ${cls}"></div>`;
  if(c==null || !(c>=0&&c<52)) return `<div class="card slot ${cls}"></div>`;
  const r=RANKS[c%13], su=Math.floor(c/13);
  return `<div class="card ${su===1||su===2?'red':''} ${cls}"><span class="r">${r==='T'?'10':r}</span><span class="s">${SUITS[su]}</span></div>`;
}
function toast(msg){ const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>{t.style.opacity=0;setTimeout(()=>t.remove(),300)},2200); }
async function copy(text){ try{ await navigator.clipboard.writeText(text); return true; }catch(e){ const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); let ok=false; try{ok=document.execCommand('copy')}catch(_){} ta.remove(); return ok; } }
async function share(text,url){
  const full = text+'\n'+url;
  if(navigator.share){ try{ await navigator.share({text:full}); return; }catch(e){ if(e && e.name==='AbortError') return; } }
  await copy(full); toast('Link copied — paste it into your chat');
}
function smsHref(text,url){ return 'sms:?&body='+encodeURIComponent(text+'\n'+url); }
function sendButtons(label,text,url){
  window._send={text,url};
  return `<button class="green" onclick="share(_send.text,_send.url)">${label}</button>
    <div class="row"><a class="btn ghost" href="${esc(smsHref(text,url))}">Text it</a><button class="ghost" onclick="copy(_send.text+'\\n'+_send.url).then(()=>toast('Link copied'))">Copy link</button></div>`;
}
