/* ================= CONFIG =================
   Set PUBLIC_URL to the address where you host this file, e.g.
   'https://yourname.github.io/holdem/'. Leave blank to use the current page address. */
const PUBLIC_URL = '';
const START_STACK = 1000, SB = 10, BB = 20;

/* ================= ENGINE (pure logic) ================= */
const RANKS = '23456789TJQKA';
const SUITS = ['♠︎','♥︎','♦︎','♣︎'];
const RN = ['Twos','Threes','Fours','Fives','Sixes','Sevens','Eights','Nines','Tens','Jacks','Queens','Kings','Aces'];
const R1 = ['2','3','4','5','6','7','8','9','10','Jack','Queen','King','Ace'];

function rnd(n){ const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
function shuffled(){ const d=[...Array(52).keys()]; for(let i=51;i>0;i--){ const j=rnd(i+1); [d[i],d[j]]=[d[j],d[i]]; } return d; }
function cardStr(c){ const r=RANKS[c%13]; return (r==='T'?'10':r)+SUITS[Math.floor(c/13)]; }

function eval5(cs){
  const rs = cs.map(c=>c%13).sort((a,b)=>b-a);
  const flush = cs.every(c=>Math.floor(c/13)===Math.floor(cs[0]/13));
  let sh = -1;
  if(new Set(rs).size===5){ if(rs[0]-rs[4]===4) sh=rs[0]; else if(rs[0]===12 && rs[1]===3) sh=3; }
  const cnt = {}; rs.forEach(r=>cnt[r]=(cnt[r]||0)+1);
  const g = Object.keys(cnt).map(Number).sort((a,b)=>cnt[b]-cnt[a]||b-a);
  const shape = g.map(x=>cnt[x]).join('');
  let cat, tb;
  if(sh>=0 && flush){cat=8;tb=[sh];}
  else if(shape==='41'){cat=7;tb=g;}
  else if(shape==='32'){cat=6;tb=g;}
  else if(flush){cat=5;tb=rs;}
  else if(sh>=0){cat=4;tb=[sh];}
  else if(shape==='311'){cat=3;tb=g;}
  else if(shape==='221'){cat=2;tb=g;}
  else if(shape==='2111'){cat=1;tb=g;}
  else {cat=0;tb=rs;}
  let score = cat; for(let i=0;i<5;i++) score = score*13 + (tb[i]||0);
  return {score, cat, tb, cards:cs};
}
function best(cards){
  let b = null; const n = cards.length;
  const pick = (start, chosen) => {
    if(chosen.length===5){ const e=eval5(chosen); if(!b||e.score>b.score) b=e; return; }
    for(let i=start;i<=n-(5-chosen.length);i++) pick(i+1,[...chosen,cards[i]]);
  };
  pick(0,[]); return b;
}
function handName(e){
  const t=e.tb;
  switch(e.cat){
    case 8: return t[0]===12?'Royal Flush':`Straight Flush, ${R1[t[0]]} high`;
    case 7: return `Four ${RN[t[0]]}`;
    case 6: return `Full House, ${RN[t[0]]} over ${RN[t[1]]}`;
    case 5: return `Flush, ${R1[t[0]]} high`;
    case 4: return `Straight, ${R1[t[0]]} high`;
    case 3: return `Three ${RN[t[0]]}`;
    case 2: return `Two Pair, ${RN[t[0]]} & ${RN[t[1]]}`;
    case 1: return `Pair of ${RN[t[0]]}`;
    default: return `${R1[t[0]]} High`;
  }
}

function newGame(name){
  return {v:1, id:Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4), seq:0, from:0,
    names:[name,null], stacks:[START_STACK,START_STACK], hand:0, button:1, status:'invite', feed:[], last:null};
}
function log(s,msg){ s.feed.push(msg); if(s.feed.length>16) s.feed = s.feed.slice(-16); }
function post(s,p,amt){ const a=Math.min(amt,s.stacks[p]); s.stacks[p]-=a; s.bets[p]+=a; }

function startHand(s){
  if(s.stacks[0]<=0 || s.stacks[1]<=0){ s.status='over'; s.winner = s.stacks[0]>0?0:1; s.toAct=-1; return; }
  s.hand++; s.button = 1-s.button; s.status='play';
  const d = shuffled();
  s.holes = [[d.pop(),d.pop()],[d.pop(),d.pop()]];
  s.deck = d; s.board=[]; s.street=0; s.pot=0; s.bets=[0,0]; s.acted=[false,false]; s.folded=-1; s.lastRaise=BB;
  const sb = s.button, bb = 1-sb;
  log(s, `— Hand ${s.hand} · ${s.names[sb]} deals —`);
  post(s,sb,SB); post(s,bb,BB);
  s.toAct = sb;               // heads-up: dealer/small blind acts first preflop
  settle(s);
}
function needs(s,p){ return s.folded<0 && s.stacks[p]>0 && (!s.acted[p] || s.bets[p]<s.bets[1-p]); }
function settle(s){
  if(needs(s,s.toAct)) return;
  if(needs(s,1-s.toAct)){ s.toAct = 1-s.toAct; return; }
  endStreet(s);
}
function dealStreet(s){
  s.street++; const n = s.street===1?3:1, cs=[];
  for(let i=0;i<n;i++) cs.push(s.deck.pop());
  s.board.push(...cs);
  log(s, `${['','Flop','Turn','River'][s.street]}: ${cs.map(cardStr).join(' ')}`);
}
function endStreet(s){
  const [a,b] = s.bets;
  if(a!==b){ const hi = a>b?0:1, diff=Math.abs(a-b); s.stacks[hi]+=diff; s.bets[hi]-=diff; } // return uncalled chips
  s.pot += s.bets[0]+s.bets[1]; s.bets=[0,0]; s.acted=[false,false]; s.lastRaise=BB;
  if(s.street===3){ showdown(s); return; }
  if(s.stacks[0]===0 || s.stacks[1]===0){ while(s.street<3) dealStreet(s); showdown(s); return; }
  dealStreet(s);
  s.toAct = 1-s.button;      // big blind acts first after the flop
}
function showdown(s){
  const e = [0,1].map(p=>best([...s.holes[p],...s.board]));
  const pot = s.pot;
  const w = e[0].score>e[1].score?0 : e[1].score>e[0].score?1 : -1;
  if(w>=0) s.stacks[w]+=pot;
  else { const half=Math.floor(pot/2); s.stacks[0]+=half; s.stacks[1]+=half; s.stacks[1-s.button]+=pot-2*half; }
  s.pot = 0;
  log(s, `${s.names[0]}: ${s.holes[0].map(cardStr).join(' ')} · ${s.names[1]}: ${s.holes[1].map(cardStr).join(' ')}`);
  const text = w<0 ? `Split pot — both have ${handName(e[0])}` : `${s.names[w]} wins ${pot} with ${handName(e[w])}`;
  log(s, text);
  s.last = {hand:s.hand, showdown:true, holes:s.holes.map(h=>h.slice()), board:s.board.slice(), winner:w, pot, hands:e.map(handName), win:w>=0?e[w].cards:[], text};
  startHand(s);
}
function winByFold(s,folder){
  const w = 1-folder, pot = s.pot+s.bets[0]+s.bets[1];
  s.stacks[w]+=pot; s.pot=0; s.bets=[0,0];
  const text = `${s.names[folder]} folds — ${s.names[w]} wins ${pot}`;
  log(s, text);
  s.last = {hand:s.hand, showdown:false, board:s.board.slice(), winner:w, pot, text};
  startHand(s);
}
function limits(s,p){
  const o=1-p, toCall=Math.max(0,s.bets[o]-s.bets[p]), maxTo=s.bets[p]+s.stacks[p];
  const canRaise = s.stacks[o]>0 && s.stacks[p]>toCall;
  const minTo = Math.min(maxTo, s.bets[o]+s.lastRaise);
  const potSize = s.pot+s.bets[0]+s.bets[1];
  return {toCall:Math.min(toCall,s.stacks[p]), canCheck:toCall===0, canRaise, minTo, maxTo, potSize, opener:s.bets[o]===0};
}
function act(s,p,type,amt){
  const o=1-p, L=limits(s,p), nm=s.names[p];
  if(type==='fold'){ s.folded=p; winByFold(s,p); return; }
  if(type==='check'){ log(s,`${nm} checks`); }
  else if(type==='call'){ post(s,p,L.toCall); log(s,`${nm} calls ${L.toCall}${s.stacks[p]===0?' (all-in)':''}`); }
  else if(type==='raise'){
    const to = Math.max(L.minTo, Math.min(Math.round(amt), L.maxTo));
    const raiseBy = to - s.bets[o];
    if(raiseBy>=s.lastRaise) s.lastRaise = raiseBy;
    s.stacks[p] -= to - s.bets[p]; s.bets[p] = to; s.acted[o] = false;
    log(s, `${nm} ${L.opener?'bets':'raises to'} ${to}${s.stacks[p]===0?' (all-in)':''}`);
  }
  s.acted[p]=true; s.toAct=o; settle(s);
}
/* ================= END ENGINE ================= */
