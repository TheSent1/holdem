/* ---------- screens ---------- */
let cur=null; // {s, seat, code}

function renderHome(err){
  cur=null;
  const name=LS.get('hx_name')||'';
  const list=games();
  app.innerHTML=`
    <div class="center logo">♠︎ ♥︎ ♣︎ ♦︎</div>
    <h1 class="center">Pocket Hold'em</h1>
    <p class="center">Heads-up Texas Hold'em over text. Works on iPhone and Android, no app needed.</p>
    ${err?`<div class="banner">${esc(err)}</div>`:''}
    <div class="panel">
      <h2>New game</h2>
      <input id="nm" maxlength="16" placeholder="Your name" value="${esc(name)}" autocomplete="nickname">
      <button onclick="createGame()">Challenge a friend</button>
      <p class="small">1,000 chips each · blinds 10/20 · last one with chips wins.</p>
    </div>
    ${list.length?`<div class="panel"><h2>Your games</h2>${list.map(g=>`<div class="list-item"><span>vs ${esc(g.opp)}${g.over?' · finished':''}</span><button class="ghost" onclick="openSaved('${esc(g.id)}')">Open</button></div>`).join('')}</div>`:''}
    <div class="panel">
      <h2>Got a game link?</h2>
      <p class="small">Normally you just tap the link in your messages. If it opened somewhere else, paste it here.</p>
      <input id="paste" placeholder="Paste link">
      <button class="ghost" onclick="openPasted()">Open</button>
    </div>`;
}
function createGame(){
  const n=(document.getElementById('nm').value||'').trim().slice(0,16);
  if(!n){ toast('Enter your name first'); return; }
  LS.set('hx_name',n);
  const s=newGame(n);
  finalize(s,0);
}
async function openSaved(id){
  const code=LS.get('hx_code_'+id); if(!code) return;
  location.hash='g='+code;
}
function openPasted(){
  const v=document.getElementById('paste').value; const m=v.match(/g=([\w-]+)/) || v.trim().match(/^([\w-]{20,})$/);
  if(!m){ toast('That doesn\'t look like a game link'); return; }
  location.hash='g='+m[1];
}

async function finalize(s,seat){
  s.seq++; s.from=seat;
  const code=await encode(s);
  remember(s,code,seat);
  history.replaceState(null,'','#g='+code);
  cur={s,seat,code};
  render();
}

function renderInvite(s,code){
  const url=linkFor(code);
  app.innerHTML=`
    <div class="top"><a href="#" onclick="goHome();return false">‹ Home</a><span></span></div>
    <div class="center logo">🃏</div>
    <h1 class="center">Invite ready</h1>
    <p class="center">Send this link to a friend. When they tap it and pick a name, the cards get dealt and the link comes back to you.</p>
    <div class="panel">${sendButtons('Send invite',`🃏 ${s.names[0]} challenged you to Texas Hold'em! Tap to play:`,url)}</div>`;
}
function renderJoin(s){
  const name=LS.get('hx_name')||'';
  app.innerHTML=`
    <div class="center logo">♠︎ ♥︎ ♣︎ ♦︎</div>
    <h1 class="center">${esc(s.names[0])} challenged you</h1>
    <p class="center">Heads-up Texas Hold'em · 1,000 chips each · blinds 10/20</p>
    <div class="panel">
      <input id="nm" maxlength="16" placeholder="Your name" value="${esc(name)}">
      <button onclick="joinGame()">Take a seat</button>
    </div>`;
  window._joining=s;
}
function joinGame(){
  const n=(document.getElementById('nm').value||'').trim().slice(0,16);
  if(!n){ toast('Enter your name first'); return; }
  LS.set('hx_name',n);
  const s=window._joining; s.names[1]=n; s.status='play';
  log(s,`${n} joined. Shuffle up and deal!`);
  startHand(s);
  finalize(s,1);
}
function renderStale(s){
  app.innerHTML=`
    <h1>That's an old move</h1>
    <p>You've already played past this link. Open your latest game state instead.</p>
    <button onclick="openSaved('${esc(s.id)}')">Open latest</button>
    <button class="ghost" onclick="goHome()">Home</button>`;
}
function goHome(){ history.replaceState(null,'',location.pathname); renderHome(); }

function strength(s,seat){
  const h=s.holes[seat];
  if(s.board.length>=3) return handName(best([...h,...s.board]));
  const [a,b]=h.map(c=>c%13).sort((x,y)=>y-x);
  if(a===b) return `Pocket ${RN[a]}`;
  return `${R1[a]}-${R1[b]}${Math.floor(h[0]/13)===Math.floor(h[1]/13)?' suited':''}`;
}
