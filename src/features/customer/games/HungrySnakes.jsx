"use client";
/**
 * HungrySnakes  (EAT60 game component)
 *
 * Usage:  <div style={{ height: "100dvh" }}><HungrySnakes onGameEnd={(r) => saveToServer(r)} /></div>
 *
 * Props
 *   onGameEnd(result)  {score, xp, coins, note, totals:{xp,coins}}  called when a run ends.
 *                      Save it to your backend and VALIDATE + CAP XP/coins on the SERVER too.
 *   config             overrides: XP_PER_POINT, XP_MAX_PER_PLAY, XP_PLAYS_PER_DAY, COINS_PER_PLAY, DAILY_COIN_CAP, MIN_SCORE_VALID
 *   storageKey         localStorage prefix for the demo wallet (default "hs")
 * The parent element must have a height.
 */
import { useEffect, useRef, useState } from "react";

const CSS = `
.hs-root{position:relative;width:100%;height:100%;overflow:hidden;box-sizing:border-box;background:#0b1020;color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
.hs-root{position:relative;height:100%;width:100%}.hs-root canvas{position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;display:block}.hs-root .hs-hud{position:absolute;top:calc(10px + env(safe-area-inset-top,0px));left:12px;right:12px;display:flex;gap:8px;align-items:center}.hs-root .hs-chip{padding:6px 10px;border-radius:16px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);backdrop-filter:blur(6px);font-size:11px;letter-spacing:.05em;text-transform:uppercase;opacity:.95}.hs-root .hs-chip b{display:inline-block;font-size:18px;margin-left:5px;letter-spacing:0;text-transform:none}.hs-root .hs-bump{animation:hsbump .3s ease-out}
@keyframes hsbump{50%{transform:scale(1.4);color:#ffd25a}}.hs-root .hs-fs{margin-left:auto;width:38px;height:38px;border-radius:14px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.1);color:#fff;font-size:18px;padding:0}.hs-root .hs-dpad{position:absolute;left:50%;bottom:calc(14px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);display:grid;grid-template-columns:repeat(3,62px);grid-template-rows:repeat(2,62px);gap:8px}.hs-root .hs-b{position:relative;overflow:hidden;padding:0;display:grid;place-items:center;color:#fff;border-radius:20px;border:1px solid rgba(255,255,255,.22);background:linear-gradient(160deg,rgba(255,255,255,.22),rgba(255,255,255,.06));backdrop-filter:blur(6px);transition:background .25s,box-shadow .25s}.hs-root .hs-b i{width:22px;height:22px;background:currentColor;clip-path:polygon(50% 8%,92% 74%,8% 74%);transform:rotate(var(--r,0deg))}.hs-root .hs-b::after{content:"";position:absolute;inset:0;border-radius:inherit;background:radial-gradient(circle,rgba(255,255,255,.75),transparent 60%);opacity:0}.hs-root .hs-b.hs-pr{animation:hstap .22s ease-out}.hs-root .hs-b.hs-pr::after{animation:hsrip .45s ease-out}.hs-root .hs-b.hs-cur{background:linear-gradient(160deg,#ffa23f,#ff5a1f);box-shadow:0 0 22px rgba(255,120,40,.75)}
@keyframes hstap{50%{transform:scale(.84)}}
@keyframes hsrip{0%{opacity:.9;transform:scale(.3)}100%{opacity:0;transform:scale(1.7)}}.hs-root .hs-up{grid-column:2;grid-row:1}.hs-root .hs-lf{grid-column:1;grid-row:2}.hs-root .hs-dn{grid-column:2;grid-row:2}.hs-root .hs-rt{grid-column:3;grid-row:2}.hs-root .hs-ov{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(5,8,25,.55);backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity .35s}.hs-root .hs-ov.hs-show{opacity:1;pointer-events:auto}.hs-root .hs-card{text-align:center;padding:26px 30px;border-radius:28px;background:linear-gradient(160deg,rgba(255,255,255,.16),rgba(255,255,255,.05));border:1px solid rgba(255,255,255,.22);transform:translateY(24px) scale(.9);transition:transform .45s cubic-bezier(.2,1.4,.4,1)}.hs-root .hs-show .hs-card{transform:none}.hs-root .hs-snk{font-size:56px;display:inline-block;animation:hswig 1.4s ease-in-out infinite}
@keyframes hswig{0%,100%{transform:rotate(-8deg) translateY(0)}50%{transform:rotate(8deg) translateY(-6px)}}.hs-root h1{margin:6px 0 4px;font-size:28px}.hs-root p{margin:0 0 18px;opacity:.8;font-size:14px}.hs-root .hs-go{border:0;border-radius:18px;padding:14px 34px;font-size:17px;font-weight:700;color:#fff;background:linear-gradient(160deg,#ffa23f,#ff4d1f);box-shadow:0 8px 24px rgba(255,90,30,.45);animation:hspulse 1.6s ease-in-out infinite}
@keyframes hspulse{50%{transform:scale(1.06)}}.hs-root .hs-rw{margin:-6px 0 16px;font-size:15px;line-height:1.8;font-weight:600}.hs-root .hs-rw .hs-tot{opacity:.75;font-weight:500;font-size:13px}.hs-root .hs-rw .hs-nt{color:#ffb35a;font-size:12px;font-weight:500}`;
const tap = (b) => { try { b.animate([{ transform: "scale(1)" }, { transform: "scale(.86)" }, { transform: "scale(1)" }], { duration: 200 }); b.animate([{ opacity: 0.9, transform: "scale(.3)" }, { opacity: 0, transform: "scale(1.7)" }], { duration: 420, pseudoElement: "::after" }); } catch (e) {} };

export default function HungrySnakes({ config, onGameEnd, storageKey = "hs", className = "", style }) {
  const cvRef = useRef(null), rootRef = useRef(null), dpadRef = useRef(null), startRef = useRef(() => {}), pressRef = useRef(() => {}), endRef = useRef(onGameEnd);
  endRef.current = onGameEnd;
  const [score, setScore] = useState(0), [best, setBest] = useState(0), [coins, setCoins] = useState(0), [dirUi, setDirUi] = useState(1);
  const [ui, setUi] = useState({ show: true, title: "Hungry Snakes", text: "Eat food, dodge the 🌶️ — this snake hates spice!", r: null, tot: null, btn: "Play" });

  useEffect(() => {

const cv=cvRef.current,ctx=cv.getContext('2d');
const timers=[];let raf=0;
const KEYW=storageKey+'_wallet',KEYB=storageKey+'_best';
const ANG=[-Math.PI/2,0,Math.PI/2,Math.PI],E=['🍕','🍔','🌯','🍜','🧀','🍟','🌭'];
const R=11,SP=4;
let W,H,A,DPR,state='ready',t=0,DT=0,hx,hy,ang,dir,L,trail,pts=[],speed,score,food,parts=[],pops=[],bulges=[],deadT=0,flash=0,best=0;
try{best=+localStorage.getItem(KEYB)||0}catch(e){}
setBest(best);
// ===== GAME CONFIG (tune these) =====
const CFG={XP_PER_FOOD:3,XP_MAX_PER_PLAY:60,XP_PLAYS_PER_DAY:7,COINS_PER_PLAY:25,DAILY_COIN_CAP:200,MIN_SCORE_VALID:5,CHILLI_START_SCORE:2,...(config||{})};
let chilli=[],chT=2,dieWhy='';
const todayKey=()=>{const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()};
let wallet={xp:0,coins:0,day:'',plays:0,xpPlays:0,coinsToday:0};
try{Object.assign(wallet,JSON.parse(localStorage.getItem(KEYW)||'{}'))}catch(e){}
function rollDay(){if(wallet.day!==todayKey()){wallet.day=todayKey();wallet.plays=0;wallet.xpPlays=0;wallet.coinsToday=0}}
function saveWallet(){try{localStorage.setItem(KEYW,JSON.stringify(wallet))}catch(e){}}
// XP + coin rules in ONE place
function settle(score){
  rollDay();
  const r={score,xp:0,coins:0,note:''};
  if(score>=CFG.MIN_SCORE_VALID){
    wallet.plays++;
    if(wallet.xpPlays<CFG.XP_PLAYS_PER_DAY){r.xp=Math.min(CFG.XP_MAX_PER_PLAY,score*CFG.XP_PER_FOOD);wallet.xpPlays++}
    else r.note='Daily XP limit reached';
    const room=Math.max(0,CFG.DAILY_COIN_CAP-wallet.coinsToday);
    r.coins=Math.min(CFG.COINS_PER_PLAY,room);
    if(!r.coins)r.note=(r.note?r.note+' · ':'')+'Daily coin cap reached';
    wallet.xp+=r.xp;wallet.coins+=r.coins;wallet.coinsToday+=r.coins;
  }else r.note='Eat '+CFG.MIN_SCORE_VALID+'+ food to earn rewards';
  saveWallet();return r;
}
setCoins(wallet.coins);
const bub=Array.from({length:16},()=>({x:Math.random(),y:Math.random(),r:8+Math.random()*26,s:.01+Math.random()*.03}));

function resize(){
  DPR=Math.min(devicePixelRatio||1,2);W=cv.clientWidth;H=cv.clientHeight;
  cv.width=W*DPR;cv.height=H*DPR;ctx.setTransform(DPR,0,0,DPR,0,0);
  const bot=(dpadRef.current?dpadRef.current.offsetHeight:150)+26;
  A={x:10,y:62,w:W-20,h:Math.max(140,H-62-bot)};
}
function sample(){
  const out=[{x:hx,y:hy}],n=Math.floor(L/SP);let need=SP,prev={x:hx,y:hy};
  for(let k=trail.length-1;k>=0&&out.length<n;k--){
    const p=trail[k];let d=Math.hypot(p.x-prev.x,p.y-prev.y);
    while(d>=need&&out.length<n){
      const f=need/d,nx=prev.x+(p.x-prev.x)*f,ny=prev.y+(p.y-prev.y)*f;
      out.push({x:nx,y:ny});prev={x:nx,y:ny};d=Math.hypot(p.x-prev.x,p.y-prev.y);need=SP;
    }
    need-=d;prev=p;
  }
  return out;
}
function reset(){
  dir=1;ang=0;L=110;score=0;speed=150;parts=[];chilli=[];chT=2;pops=[];bulges=[];flash=0;
  hx=A.x+A.w*.3;hy=A.y+A.h/2;
  trail=[];for(let k=Math.ceil(L+40);k>=0;k-=3)trail.push({x:hx-k,y:hy});
  pts=sample();setScore(0);food=null;spawn();setCur();
}
function spawn(){
  for(let i=0;i<30;i++){
    const x=A.x+28+Math.random()*(A.w-56),y=A.y+28+Math.random()*(A.h-56);
    if(Math.hypot(x-hx,y-hy)<80||pts.some(p=>Math.hypot(p.x-x,p.y-y)<28)||chilli.some(c=>Math.hypot(c.x-x,c.y-y)<40))continue;
    food={x,y,e:E[Math.random()*E.length|0],b:t};return;
  }
  food={x:A.x+A.w/2,y:A.y+A.h/2,e:'🍕',b:t};
}
function spawnChilli(){
  for(let i=0;i<30;i++){
    const x=A.x+26+Math.random()*(A.w-52),y=A.y+26+Math.random()*(A.h-52);
    if(Math.hypot(x-hx,y-hy)<130||(food&&Math.hypot(x-food.x,y-food.y)<50)||pts.some(p=>Math.hypot(p.x-x,p.y-y)<30))continue;
    const mv=score>=8&&Math.random()<.5,a=Math.random()*6.283;
    chilli.push({x,y,b:t,warn:1.1,life:7+Math.random()*3,vx:mv?Math.cos(a)*28:0,vy:mv?Math.sin(a)*28:0});return;
  }
}
function setCur(){setDirUi(dir)}
function burst(x,y,n,cols){for(let i=0;i<n;i++){const a=Math.random()*6.283,s=60+Math.random()*160;parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,l:1,c:cols[i%cols.length],r:2+Math.random()*3})}}
function press(i){
  if(state!=='play')return;
  const d=Math.abs(Math.atan2(Math.sin(ANG[i]-ang),Math.cos(ANG[i]-ang)));
  if(d>2.5)return;dir=i;setCur();
}
function eat(){
  score++;L+=24;speed=Math.min(240,150+score*3);
  setScore(score);
  burst(food.x,food.y,16,['#ffd25a','#ff7a3c','#3dff9a','#fff']);
  pops.push({x:food.x,y:food.y,t:0});bulges.push(0);flash=1;
  try{navigator.vibrate&&navigator.vibrate(15)}catch(e){}
  spawn();
}
function die(){
  state='dead';deadT=0;flash=1;burst(hx,hy,26,['#ff4d4d','#ff9a3c','#fff']);
  try{navigator.vibrate&&navigator.vibrate([60,40,90])}catch(e){}
  if(score>best){best=score;setBest(best);try{localStorage.setItem(KEYB,best)}catch(e){}}
  const r=settle(score);setCoins(wallet.coins);
  if(endRef.current)try{endRef.current({score,xp:r.xp,coins:r.coins,note:r.note,totals:{xp:wallet.xp,coins:wallet.coins}})}catch(e){}
  const why=dieWhy==='chilli';dieWhy='';
  timers.push(setTimeout(()=>setUi({show:true,title:why?'Too spicy! 🥵':'Game Over',text:'Score '+score+'  ·  Best '+best,r,tot:{xp:wallet.xp,coins:wallet.coins},btn:'Play again'}),700));
}
function step(dt){
  let d=ANG[dir]-ang;d=Math.atan2(Math.sin(d),Math.cos(d));
  const m=12*dt;ang+=Math.abs(d)<m?d:Math.sign(d)*m;
  hx+=Math.cos(ang)*speed*dt;hy+=Math.sin(ang)*speed*dt;
  const l=trail[trail.length-1];
  if(Math.hypot(hx-l.x,hy-l.y)>=2.5){trail.push({x:hx,y:hy});if(trail.length>2200)trail.splice(0,600)}
  pts=sample();
  if(food&&Math.hypot(hx-food.x,hy-food.y)<R+16)eat();
  if(score>=CFG.CHILLI_START_SCORE){chT-=dt;if(chT<=0&&chilli.length<Math.min(5,1+(score/4|0))){spawnChilli();chT=Math.max(1.6,4.2-score*.12)}}
  for(const c of chilli){c.life-=dt;if(c.warn>0)c.warn-=dt;else{c.x+=c.vx*dt;c.y+=c.vy*dt;if(c.x<A.x+18||c.x>A.x+A.w-18)c.vx*=-1;if(c.y<A.y+18||c.y>A.y+A.h-18)c.vy*=-1}}
  chilli=chilli.filter(c=>c.life>0);
  for(const c of chilli)if(c.warn<=0&&Math.hypot(hx-c.x,hy-c.y)<R+12){dieWhy='chilli';return die()}
  if(hx<A.x+R*.5||hx>A.x+A.w-R*.5||hy<A.y+R*.5||hy>A.y+A.h-R*.5)return die();
  for(let i=9;i<pts.length;i++)if(Math.hypot(hx-pts[i].x,hy-pts[i].y)<R*.9)return die();
}
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function circ(x,y,r){ctx.moveTo(x+r,y);ctx.arc(x,y,r,0,6.2832)}

function drawSnake(){
  const n=pts.length;if(n<2)return;const w=[];
  for(let i=0;i<n;i++){
    const a=pts[Math.max(0,i-1)],b=pts[Math.min(n-1,i+1)];
    let dx=b.x-a.x,dy=b.y-a.y;const m=Math.hypot(dx,dy)||1;dx/=m;dy/=m;
    const o=Math.sin(t*7-i*.5)*5*Math.min(1,i/8)*(1-.35*i/n);
    let r=R*(1-.5*Math.pow(i/n,1.6));
    for(const bg of bulges)r+=5*Math.exp(-((i-bg)*(i-bg))/8);
    w.push({x:pts[i].x-dy*o,y:pts[i].y+dx*o,r:i<3?R+1:r});
  }
  ctx.save();if(state==='dead')ctx.globalAlpha=Math.max(.2,1-deadT*.8);
  ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();for(const p of w)circ(p.x+3,p.y+5,p.r+1);ctx.fill();
  ctx.fillStyle=state==='dead'?'#4a0f14':'#07382a';ctx.beginPath();for(const p of w)circ(p.x,p.y,p.r+2.2);ctx.fill();
  for(let i=n-1;i>=0;i--){
    const p=w[i];
    ctx.fillStyle=state==='dead'?`hsl(${i%2?5:15},70%,50%)`:`hsl(${145+Math.min(i,60)*.6},80%,${51-Math.min(i,60)*.12}%)`;
    ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,6.2832);ctx.fill();
  }
  for(let i=n-1;i>=1;i--){
    const p=w[i];
    if(i%4===2&&i>3){ctx.fillStyle='rgba(255,210,90,.85)';ctx.beginPath();ctx.arc(p.x,p.y,p.r*.34,0,6.2832);ctx.fill()}
    ctx.fillStyle='rgba(255,255,255,.16)';ctx.beginPath();ctx.arc(p.x-p.r*.25,p.y-p.r*.3,p.r*.5,0,6.2832);ctx.fill();
  }
  // head
  const h=pts[0],c=Math.cos(ang),s=Math.sin(ang);
  if(state!=='dead'){
    const f=Math.sin(t*4)-.55;
    if(f>0){
      const len=R+8+16*f,tx=h.x+c*len,ty=h.y+s*len;
      ctx.strokeStyle='#ff3b5c';ctx.lineWidth=2.2;ctx.lineCap='round';ctx.beginPath();
      ctx.moveTo(h.x+c*R,h.y+s*R);ctx.lineTo(tx,ty);
      ctx.moveTo(tx,ty);ctx.lineTo(tx+c*5-s*4,ty+s*5+c*4);
      ctx.moveTo(tx,ty);ctx.lineTo(tx+c*5+s*4,ty+s*5-c*4);ctx.stroke();
    }
  }
  ctx.fillStyle=state==='dead'?'#ff6a4d':'#5dffb0';ctx.beginPath();ctx.arc(h.x,h.y,R+2.2,0,6.2832);ctx.fill();
  const scared=chilli.some(c=>c.warn<=0&&Math.hypot(h.x-c.x,h.y-c.y)<85);
  for(const sg of [-1,1]){
    const ex=h.x+c*4.5-s*6.2*sg,ey=h.y+s*4.5+c*6.2*sg;
    if(state==='dead'){
      ctx.strokeStyle='#220';ctx.lineWidth=1.8;ctx.beginPath();
      ctx.moveTo(ex-2.6,ey-2.6);ctx.lineTo(ex+2.6,ey+2.6);ctx.moveTo(ex+2.6,ey-2.6);ctx.lineTo(ex-2.6,ey+2.6);ctx.stroke();
    }else{
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex,ey,scared?5.5:4.4,0,6.2832);ctx.fill();
      let lx=c,ly=s;if(food){const dx=food.x-ex,dy=food.y-ey,m=Math.hypot(dx,dy)||1;lx=dx/m;ly=dy/m}
      ctx.fillStyle='#14212b';ctx.beginPath();ctx.arc(ex+lx*1.6,ey+ly*1.6,scared?1.1:2.2,0,6.2832);ctx.fill();
    }
  }
  ctx.restore();
}
function draw(){
  const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#1b0f3a');g.addColorStop(1,'#071a33');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  for(const b of bub){
    const x=b.x*W+Math.sin(t*.6+b.r)*14,y=b.y*H;
    const rg=ctx.createRadialGradient(x,y,0,x,y,b.r*2);rg.addColorStop(0,'rgba(120,160,255,.16)');rg.addColorStop(1,'rgba(120,160,255,0)');
    ctx.fillStyle=rg;ctx.fillRect(x-b.r*2,y-b.r*2,b.r*4,b.r*4);
  }
  ctx.save();
  if(state==='dead'&&deadT<.5)ctx.translate((Math.random()-.5)*8*(1-deadT*2),(Math.random()-.5)*8*(1-deadT*2));
  rr(A.x,A.y,A.w,A.h,22);ctx.fillStyle='rgba(10,16,40,.72)';ctx.fill();
  ctx.save();ctx.clip();
  for(let x=A.x+10;x<A.x+A.w;x+=22)for(let y=A.y+10;y<A.y+A.h;y+=22){
    ctx.fillStyle=`rgba(120,200,255,${.1+.14*Math.max(0,Math.sin(x*.025+y*.02-t*2.2))})`;ctx.fillRect(x-1,y-1,2.4,2.4);
  }
  ctx.restore();
  ctx.lineWidth=2.5;ctx.shadowBlur=14+flash*12;
  ctx.shadowColor=flash>0?'#ffa23f':'#3dff9a';ctx.strokeStyle=flash>0?`rgba(255,170,60,${.5+.5*flash})`:'rgba(80,255,170,.5)';
  rr(A.x,A.y,A.w,A.h,22);ctx.stroke();ctx.shadowBlur=0;
  if(food){
    const k=Math.min(1,(t-food.b)/.4),sc=k<1?1+2.70158*Math.pow(k-1,3)+1.70158*Math.pow(k-1,2):1;
    const by=food.y+Math.sin(t*3)*3,pl=1+.08*Math.sin(t*6);
    const rg=ctx.createRadialGradient(food.x,by,0,food.x,by,36);rg.addColorStop(0,`rgba(255,190,80,${.35*pl})`);rg.addColorStop(1,'rgba(255,190,80,0)');
    ctx.fillStyle=rg;ctx.fillRect(food.x-36,by-36,72,72);
    ctx.save();ctx.translate(food.x,by);ctx.scale(sc*pl,sc*pl);
    ctx.font='28px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(food.e,0,1);ctx.restore();
  }
  for(const c of chilli){
    const wr=c.warn>0,a=wr?.35+.35*Math.sin(t*20):(c.life<1.2?.4+.6*Math.abs(Math.sin(t*14)):1);
    const k=Math.min(1,(t-c.b)/.35),sc=k<1?1+2.70158*Math.pow(k-1,3)+1.70158*Math.pow(k-1,2):1;
    const rg=ctx.createRadialGradient(c.x,c.y,0,c.x,c.y,32);rg.addColorStop(0,`rgba(255,40,30,${.45*a})`);rg.addColorStop(1,'rgba(255,40,30,0)');
    ctx.fillStyle=rg;ctx.fillRect(c.x-36,c.y-36,72,72);
    if(wr){ctx.strokeStyle=`rgba(255,80,60,${a})`;ctx.lineWidth=2;ctx.setLineDash([5,5]);ctx.beginPath();ctx.arc(c.x,c.y,18+Math.sin(t*10)*2,0,6.2832);ctx.stroke();ctx.setLineDash([])}
    ctx.save();ctx.globalAlpha=a;ctx.translate(c.x,c.y);ctx.rotate(Math.sin(t*5+c.b)*.25);ctx.scale(sc,sc);
    ctx.font='28px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('🌶️',0,1);ctx.restore();
  }
  drawSnake();
  for(const p of parts){ctx.globalAlpha=Math.max(0,p.l);ctx.fillStyle=p.c;ctx.beginPath();ctx.arc(p.x,p.y,p.r*p.l+.5,0,6.2832);ctx.fill()}
  ctx.globalAlpha=1;
  ctx.font='800 20px system-ui,sans-serif';ctx.textAlign='center';
  for(const p of pops){ctx.globalAlpha=Math.max(0,1-p.t/.8);ctx.fillStyle='#ffd25a';ctx.fillText('+1',p.x,p.y-14-p.t*50)}
  ctx.globalAlpha=1;ctx.restore();
}
let last=0;
function loop(ts){
  DT=Math.min(.033,(ts-last)/1000||0);last=ts;t+=DT;
  for(const b of bub){b.y-=b.s*DT;if(b.y<-.1)b.y=1.1}
  if(state==='play')step(DT);else if(state==='dead')deadT+=DT;
  flash=Math.max(0,flash-DT*3);
  bulges=bulges.map(b=>b+DT*45).filter(b=>b<pts.length+6);
  for(const p of parts){p.x+=p.vx*DT;p.y+=p.vy*DT;p.vy+=220*DT;p.l-=DT*1.8}
  parts=parts.filter(p=>p.l>0);
  for(const p of pops)p.t+=DT;pops=pops.filter(p=>p.t<.8);
  draw();raf=requestAnimationFrame(loop);
}
// input
let sx0=null,sy0=null;
const pd=e=>{sx0=e.clientX;sy0=e.clientY},pm=e=>{if(sx0==null)return;const dx=e.clientX-sx0,dy=e.clientY-sy0;if(Math.hypot(dx,dy)>22){press(Math.abs(dx)>Math.abs(dy)?(dx>0?1:3):(dy>0?2:0));sx0=e.clientX;sy0=e.clientY}},pu=()=>{sx0=null},kd=e=>{const k={ArrowUp:0,w:0,ArrowRight:1,d:1,ArrowDown:2,s:2,ArrowLeft:3,a:3}[e.key];if(k!==undefined){e.preventDefault();press(k)}};
cv.addEventListener('pointerdown',pd);cv.addEventListener('pointermove',pm);window.addEventListener('pointerup',pu);window.addEventListener('keydown',kd);
const ro=new ResizeObserver(()=>{resize();if(state==='ready')reset()});ro.observe(cv);
pressRef.current=press;
startRef.current=()=>{setUi(p=>({...p,show:false}));resize();reset();state='play'};
resize();reset();raf=requestAnimationFrame(loop);
return()=>{cancelAnimationFrame(raf);timers.forEach(clearTimeout);cv.removeEventListener('pointerdown',pd);cv.removeEventListener('pointermove',pm);window.removeEventListener('pointerup',pu);window.removeEventListener('keydown',kd);ro.disconnect()};

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFs = () => { try { (document.fullscreenElement ? document.exitFullscreen() : rootRef.current.requestFullscreen()).catch(() => {}); } catch (e) {} };
  const canFs = typeof document !== "undefined" && !!document.documentElement.requestFullscreen;

  return (
    <div ref={rootRef} className={"hs-root " + className} style={style}>
      <style>{CSS}</style>
      <canvas ref={cvRef} />
      <div className="hs-hud">
        <div className="hs-chip">Score<b key={score} className="hs-bump">{score}</b></div>
        <div className="hs-chip">Best<b>{best}</b></div>
        <div className="hs-chip">🪙<b>{coins}</b></div>
        {canFs && <button className="hs-fs" aria-label="Fullscreen" onClick={toggleFs}>⛶</button>}
      </div>
      <div ref={dpadRef} className="hs-dpad">
        {[["up", 0, 0], ["lf", 3, 270], ["dn", 2, 180], ["rt", 1, 90]].map(([c, d, r]) => (
          <button key={c} aria-label={c} className={"hs-b hs-" + c + (dirUi === d ? " hs-cur" : "")}
            onPointerDown={(e) => { e.preventDefault(); tap(e.currentTarget); pressRef.current(d); }}>
            <i style={{ "--r": r + "deg" }} />
          </button>
        ))}
      </div>
      <div className={"hs-ov" + (ui.show ? " hs-show" : "")}>
        <div className="hs-card">
          <div className="hs-snk">🐍</div>
          <h1>{ui.title}</h1>
          <p>{ui.text}</p>
          {ui.r && (
            <div className="hs-rw">
              {(ui.r.xp || ui.r.coins) ? <div>⭐ +{ui.r.xp} XP · 🪙 +{ui.r.coins}</div> : null}
              <div className="hs-tot">Total ⭐ {ui.tot.xp} · 🪙 {ui.tot.coins}</div>
              {ui.r.note && <div className="hs-nt">{ui.r.note}</div>}
            </div>
          )}
          <button className="hs-go" onClick={() => startRef.current()}>{ui.btn}</button>
        </div>
      </div>
    </div>
  );
}
