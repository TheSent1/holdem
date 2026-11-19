function render(){
  const {s,seat}=cur;
  if(s.status==='invite') return renderInvite(s,cur.code);
  const opp=1-seat, myTurn=s.status==='play' && s.toAct===seat;
  const url=linkFor(cur.code);
  const potNow=(s.pot||0)+(s.bets?s.bets[0]+s.bets[1]:0);
  const last=s.last && (s.last.hand===s.hand-1 || s.status==='over') ? s.last : null;
  const showOpp = last && last.showdown && s.status==='over';
  const oppCards = showOpp ? last.holes[opp].map(c=>cardHTML(c,'')).join('') : (s.status==='play'?cardHTML('back')+cardHTML('back'):'');
  const myCards = s.status==='play' ? s.holes[seat].map(c=>cardHTML(c,'big')).join('') : (last&&last.showdown?last.holes[seat].map(c=>cardHTML(c,'big')).join(''):'');
  const board = (s.status==='play'?s.board:(last?last.board:[]));
  const dealerBadge=p=>s.button===p&&s.status==='play'?'<span class="dealer">D</span>':'';

  let lastBanner='';
  if(last && s.status==='play'){
    lastBanner=`<div class="banner"><span>Last hand: ${esc(last.text)}</span>${last.showdown?`<span class="cards">${last.holes[opp].map(c=>cardHTML(c,'mini')).join('')}</span>`:''}</div>`;
  }

  let status, actions='';
  if(s.status==='over'){
    const iWon=s.winner===seat;
    status=`<div class="over">${iWon?'🏆 You win the match!':`${esc(s.names[s.winner])} wins the match`}</div>`;
    actions = (s.from===seat? sendButtons(`Send result to ${esc(s.names[opp])}`, iWon?`🏆 I took all the chips in Hold'em! See the final hand:`:`GG — you won our Hold'em match. Final hand:`, url):'') +
      `<button class="${s.from===seat?'ghost':''}" onclick="rematch()">Rematch</button><button class="ghost" onclick="goHome()">Home</button>`;
  } else if(myTurn){
    status=`<div class="status go">Your turn</div>`;
    const L=limits(s,seat);
    actions=`<div class="row">
      <button class="dark" onclick="doAct('fold')">Fold</button>
      ${L.canCheck?`<button class="green" onclick="doAct('check')">Check</button>`:`<button class="green" onclick="doAct('call')">Call ${L.toCall}</button>`}
      ${L.canRaise?`<button onclick="openRaise()">${L.opener?'Bet':'Raise'}</button>`:''}
    </div><div id="raisebox"></div>`;
  } else {
    status=`<div class="status">Waiting for ${esc(s.names[opp])}</div>`;
    actions=sendButtons(`Send move to ${esc(s.names[opp])} 📲`,`♠︎ Your move in Hold'em vs ${s.names[seat]} — pot ${potNow}. Tap to play:`,url);
  }

  app.innerHTML=`
    <div class="top"><a href="#" onclick="goHome();return false">‹ Games</a><span class="small">Hand ${s.hand} · blinds ${SB}/${BB}</span></div>
    <div class="table">
      <div class="center">
        <div class="seat"><div class="cards">${oppCards}</div>
          <div class="who ${s.toAct===opp&&s.status==='play'?'turn':''}"><div class="n">${esc(s.names[opp])}${dealerBadge(opp)}</div><div class="st">${s.stacks[opp]}</div></div></div>
        ${s.status==='play'&&s.bets[opp]?`<div class="bet">${s.bets[opp]}</div>`:''}
      </div>
      <div class="center">
        <div class="board">${[0,1,2,3,4].map(i=>cardHTML(board[i])).join('')}</div>
        ${s.status==='play'?`<span class="pot">Pot ${potNow}</span>`:''}
      </div>
      <div class="center">
        ${s.status==='play'&&s.bets[seat]?`<div class="bet">${s.bets[seat]}</div>`:''}
        <div class="seat"><div class="cards">${myCards}</div>
          <div class="who ${myTurn?'turn':''}"><div class="n">You${dealerBadge(seat)}</div><div class="st">${s.stacks[seat]}</div></div></div>
        ${s.status==='play'?`<div class="strength">${esc(strength(s,seat))}</div>`:''}
      </div>
    </div>
    ${status}
    ${lastBanner}
    <div class="feed">${s.feed.slice(-7).map(f=>`<div>${esc(f)}</div>`).join('')}</div>
    <div class="actions">${actions}</div>`;
  const fd=app.querySelector('.feed'); if(fd) fd.scrollTop=fd.scrollHeight;
}

let busy=false;
async function doAct(type,amt){
  if(busy||!cur) return; busy=true;
  try{ const {s,seat}=cur; if(s.toAct!==seat||s.status!=='play') return; act(s,seat,type,amt); await finalize(s,seat); }
  finally{ busy=false; }
}
function openRaise(){
  const {s,seat}=cur, L=limits(s,seat);
  const step = L.maxTo-L.minTo>=200?10:1;
  const potTo = Math.min(L.maxTo, s.bets[1-seat] + L.potSize + L.toCall);
  const halfTo = Math.min(L.maxTo, Math.max(L.minTo, s.bets[1-seat] + Math.round((L.potSize + L.toCall)/2)));
  const box=document.getElementById('raisebox');
  box.innerHTML=`<div class="raise">
    <div class="amt" id="ramt">${L.minTo}</div>
    <input type="range" id="rng" min="${L.minTo}" max="${L.maxTo}" step="${step}" value="${L.minTo}">
    <div class="row chips">
      <button class="ghost" onclick="setR(${L.minTo})">Min</button>
      <button class="ghost" onclick="setR(${halfTo})">½ Pot</button>
      <button class="ghost" onclick="setR(${Math.max(L.minTo,potTo)})">Pot</button>
      <button class="ghost" onclick="setR(${L.maxTo})">All-in</button>
    </div>
    <div class="row"><button class="ghost" onclick="document.getElementById('raisebox').innerHTML=''">Cancel</button>
    <button id="rgo" onclick="doAct('raise',+document.getElementById('rng').value)">${L.opener?'Bet':'Raise to'} ${L.minTo}</button></div>
  </div>`;
  const rng=document.getElementById('rng');
  rng.oninput=()=>setR(+rng.value,true);
  window._L=L;
}
function setR(v,fromSlider){
  const L=window._L, rng=document.getElementById('rng');
  if(!fromSlider) rng.value=v;
  let val = v>=L.maxTo?L.maxTo:+rng.value; if(!fromSlider) val=v;
  document.getElementById('ramt').textContent = val===L.maxTo?`${val} (all-in)`:val;
  document.getElementById('rgo').textContent = `${L.opener?'Bet':'Raise to'} ${val}`;
  document.getElementById('rgo').onclick=()=>doAct('raise',val);
}
function rematch(){
  const {s,seat}=cur;
  const n=newGame(s.names[seat]); n.names=[s.names[seat], s.names[1-seat]];
  n.button = rnd(2); n.status='play';
  log(n,'Rematch! Fresh stacks.');
  startHand(n);
  finalize(n,0);
}

/* ---------- boot ---------- */
async function boot(){
  const m=location.hash.match(/g=([\w-]+)/);
  if(!m) return renderHome();
  let s;
  try{ s=await decode(m[1]); }
  catch(e){ return renderHome(typeof DecompressionStream==='undefined'?'Your browser is too old to open this game. Update iOS/Android and try again.':'That game link looks broken or cut off. Ask for it to be sent again.'); }
  let seat=LS.get('hx_seat_'+s.id); seat = seat===null?null:+seat;
  const seen=+(LS.get('hx_seq_'+s.id)??-1);
  if(s.status==='invite'){
    if(seat===0){ cur={s,seat:0,code:m[1]}; return renderInvite(s,m[1]); }
    if(seat===1 && LS.get('hx_code_'+s.id)){ location.hash='g='+LS.get('hx_code_'+s.id); return; }
    return renderJoin(s);
  }
  if(seat===null){ seat = 1-s.from; }
  if(s.seq<seen) return renderStale(s);
  if(s.seq>seen) remember(s,m[1],seat);
  cur={s,seat,code:m[1]};
  render();
}
window.addEventListener('hashchange',boot);
boot();
