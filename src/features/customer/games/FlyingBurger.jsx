"use client";
/**
 * FlyingBurger  (EAT60 game component)
 *
 * Usage:  <div style={{ height: "100dvh" }}><FlyingBurger onGameEnd={(r) => saveToServer(r)} /></div>
 *
 * Props
 *   onGameEnd(result)  {score, xp, coins, note, totals:{xp,coins}}  called when a run ends.
 *                      Save it to your backend and VALIDATE + CAP XP/coins on the SERVER too.
 *   config             overrides: XP_PER_POINT, XP_MAX_PER_PLAY, XP_PLAYS_PER_DAY, COINS_PER_PLAY, DAILY_COIN_CAP, MIN_SCORE_VALID
 *   storageKey         localStorage prefix for the demo wallet (default "fb")
 * The parent element must have a height.
 */
import { useEffect, useRef, useState } from "react";
import { playAppSound, unlockAppSounds } from "../../../lib/sounds";

const CSS = `
.fb-root{position:relative;width:100%;height:100%;overflow:hidden;box-sizing:border-box;background:#0b1020;color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
.fb-root{position:relative;height:100%;width:100%}.fb-root canvas{position:absolute;left:0;right:0;top:0;bottom:0;width:100%;height:100%;display:block}.fb-root .fb-hud{position:absolute;top:calc(10px + env(safe-area-inset-top,0px));left:12px;right:12px;display:flex;gap:8px;align-items:center;pointer-events:none}.fb-root .fb-chip{padding:6px 10px;border-radius:16px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);backdrop-filter:blur(6px);font-size:11px;letter-spacing:.05em;text-transform:uppercase}.fb-root .fb-chip b{display:inline-block;font-size:18px;margin-left:5px;letter-spacing:0;text-transform:none}.fb-root .fb-bump{animation:fbbump .3s ease-out}
@keyframes fbbump{50%{transform:scale(1.4);color:#ffd25a}}.fb-root .fb-fs{pointer-events:auto;margin-left:auto;width:38px;height:38px;border-radius:14px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.1);color:#fff;font-size:18px;padding:0}.fb-root .fb-ov{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(5,8,25,.55);backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity .35s}.fb-root .fb-ov.fb-show{opacity:1;pointer-events:auto}.fb-root .fb-card{text-align:center;padding:26px 30px;border-radius:28px;background:linear-gradient(160deg,rgba(255,255,255,.16),rgba(255,255,255,.05));border:1px solid rgba(255,255,255,.22);transform:translateY(24px) scale(.9);transition:transform .45s cubic-bezier(.2,1.4,.4,1)}.fb-root .fb-show .fb-card{transform:none}.fb-root .fb-snk{font-size:56px;display:inline-block;animation:fbwig 1.4s ease-in-out infinite}
@keyframes fbwig{0%,100%{transform:rotate(-8deg) translateY(0)}50%{transform:rotate(8deg) translateY(-8px)}}.fb-root h1{margin:6px 0 4px;font-size:28px}.fb-root p{margin:0 0 18px;opacity:.8;font-size:14px}.fb-root .fb-rw{margin:-6px 0 16px;font-size:15px;line-height:1.8;font-weight:600}.fb-root .fb-rw .fb-tot{opacity:.75;font-weight:500;font-size:13px}.fb-root .fb-rw .fb-nt{color:#ffb35a;font-size:12px;font-weight:500}.fb-root .fb-go{border:0;border-radius:18px;padding:14px 34px;font-size:17px;font-weight:700;color:#fff;background:linear-gradient(160deg,#ffa23f,#ff4d1f);box-shadow:0 8px 24px rgba(255,90,30,.45);animation:fbpulse 1.6s ease-in-out infinite}
@keyframes fbpulse{50%{transform:scale(1.06)}}`;
const tap = (b) => { try { b.animate([{ transform: "scale(1)" }, { transform: "scale(.86)" }, { transform: "scale(1)" }], { duration: 200 }); b.animate([{ opacity: 0.9, transform: "scale(.3)" }, { opacity: 0, transform: "scale(1.7)" }], { duration: 420, pseudoElement: "::after" }); } catch (e) {} };

export default function FlyingBurger({ config, onGameEnd, storageKey = "fb", className = "", style }) {
  const cvRef = useRef(null), rootRef = useRef(null), dpadRef = useRef(null), startRef = useRef(() => {}), pressRef = useRef(() => {}), endRef = useRef(onGameEnd);
  endRef.current = onGameEnd;
  const [score, setScore] = useState(0), [best, setBest] = useState(0), [coins, setCoins] = useState(0), [dirUi, setDirUi] = useState(1);
  const [ui, setUi] = useState({ show: true, title: "Flying Burger", text: "Tap to fly. Dodge pans, ladles and 🌶️. Grab 🧀 to win a layer back!", r: null, tot: null, btn: "Play" });

  useEffect(() => {

const cv=cvRef.current,ctx=cv.getContext('2d');
const timers=[];let raf=0;
const KEYW=storageKey+'_wallet',KEYB=storageKey+'_best';
// ===== GAME CONFIG (tune these) =====
const CFG={XP_PER_POINT:3,XP_MAX_PER_PLAY:60,XP_PLAYS_PER_DAY:7,COINS_PER_PLAY:25,DAILY_COIN_CAP:200,MIN_SCORE_VALID:5,CHILLI_START_SCORE:3,...(config||{})};
const todayKey=()=>{const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()};
let wallet={xp:0,coins:0,day:'',plays:0,xpPlays:0,coinsToday:0},best=0;
try{Object.assign(wallet,JSON.parse(localStorage.getItem(KEYW)||'{}'));best=+localStorage.getItem(KEYB)||0}catch(e){}
function saveWallet(){try{localStorage.setItem(KEYW,JSON.stringify(wallet))}catch(e){}}
// XP + coin rules in ONE place
function settle(score){
  if(wallet.day!==todayKey()){wallet.day=todayKey();wallet.plays=0;wallet.xpPlays=0;wallet.coinsToday=0}
  const r={score,xp:0,coins:0,note:''};
  if(score>=CFG.MIN_SCORE_VALID){
    wallet.plays++;
    if(wallet.xpPlays<CFG.XP_PLAYS_PER_DAY){r.xp=Math.min(CFG.XP_MAX_PER_PLAY,score*CFG.XP_PER_POINT);wallet.xpPlays++}
    else r.note='Daily XP limit reached';
    r.coins=Math.min(CFG.COINS_PER_PLAY,Math.max(0,CFG.DAILY_COIN_CAP-wallet.coinsToday));
    if(!r.coins)r.note=(r.note?r.note+' · ':'')+'Daily coin cap reached';
    wallet.xp+=r.xp;wallet.coins+=r.coins;wallet.coinsToday+=r.coins;
  }else r.note='Pass '+CFG.MIN_SCORE_VALID+'+ gaps to earn rewards';
  saveWallet();return r;
}
setBest(best);setCoins(wallet.coins);

const EMO='"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif';
const TH=[{n:'Kitchen 🍳',c:['#1b0f3a','#071a33']},{n:'Pizza Oven 🍕',c:['#43120f','#1a0a05']},{n:'Wok Street 🥡',c:['#073f3f','#04141f']}];
const hex=h=>[1,3,5].map(i=>parseInt(h.substr(i,2),16));
let cur=TH[0].c.map(hex);
const FL=44,BX0=.27;
let W,H,DPR,BX,state='ready',t=0,DT=0,by,vy,rot,score,lives,inv,flapT,obs,chil,pick,parts,pops,shake,floorOff,speed,theme,toast,hitBy,deadT,wait;
const bub=Array.from({length:16},()=>({x:Math.random(),y:Math.random(),r:8+Math.random()*26,s:.01+Math.random()*.03}));

function resize(){DPR=Math.min(devicePixelRatio||1,2);W=cv.clientWidth;H=cv.clientHeight;cv.width=W*DPR;cv.height=H*DPR;ctx.setTransform(DPR,0,0,DPR,0,0);BX=W*BX0}
function reset(){
  by=H*.45;vy=0;rot=0;score=0;lives=3;inv=0;flapT=0;obs=[];chil=[];pick=[];parts=[];pops=[];shake=0;floorOff=0;speed=150;theme=0;toast=null;hitBy='';deadT=0;
  setScore(0);
}
function addObs(){
  const gap=Math.max(150,205-score*1.5),cy=gap/2+80+Math.random()*(H-FL-gap-160),x=W+70;
  obs.push({x,w:64,cy,gap,p:false});
  if(score>=CFG.CHILLI_START_SCORE&&Math.random()<.45)chil.push({x:x+135,base:H*.45,amp:H*.2+Math.random()*H*.08,ph:Math.random()*6.28,y:H*.45});
  if(lives<3&&Math.random()<.3)pick.push({x:x+32,y:cy,got:false});
}
const cr=(cx,cy,r,x,y,w,h)=>{const dx=cx-Math.max(x,Math.min(cx,x+w)),dy=cy-Math.max(y,Math.min(cy,y+h));return dx*dx+dy*dy<r*r};
function burst(x,y,n,cols){for(let i=0;i<n;i++){const a=Math.random()*6.283,s=60+Math.random()*170;parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,l:1,c:cols[i%cols.length],r:2+Math.random()*3})}}
function flap(){
  if(state==='wait')state='play';
  if(state!=='play')return;
  playAppSound('burgerTap',0.5);
  vy=-440;flapT=1;
  for(let i=0;i<3;i++)parts.push({x:BX-18,y:by+8,vx:-60-Math.random()*50,vy:20+Math.random()*60,l:.7,c:'#fff',r:2+Math.random()*2});
}
const LAYER={lettuce:['#5fd35f',9],patty:['#5a2d1b',13],top:['#e8a24a',24]};
function loseLayer(src){
  if(inv>0)return;
  const nm=lives===3?'lettuce':lives===2?'patty':'top';
  parts.push({x:BX,y:by,vx:-80-Math.random()*60,vy:-220,l:1.4,c:LAYER[nm][0],w:54,h:LAYER[nm][1],rot:0,vr:(Math.random()-.5)*14});
  lives--;inv=1.4;shake=.35;hitBy=src;
  if(lives>0)playAppSound('gameHit',0.65);
  try{navigator.vibrate&&navigator.vibrate(40)}catch(e){}
  if(lives<=0)die();
}
function die(){
  playAppSound('burgerCrash');
  state='dead';deadT=0;vy=-300;burst(BX,by,26,['#ff9a3c','#e8a24a','#fff','#ff4d4d']);
  try{navigator.vibrate&&navigator.vibrate([60,40,90])}catch(e){}
  if(score>best){best=score;setBest(best);try{localStorage.setItem(KEYB,best)}catch(e){}}
  const r=settle(score);setCoins(wallet.coins);
  if(r.coins>0)playAppSound('coinCollect',0.65);
  if(endRef.current)try{endRef.current({score,xp:r.xp,coins:r.coins,note:r.note,totals:{xp:wallet.xp,coins:wallet.coins}})}catch(e){}
  const why=hitBy==='chilli'?'Too spicy! 🥵':'Burger down! 🍔';
  timers.push(setTimeout(()=>setUi({show:true,title:why,text:'Score '+score+'  ·  Best '+best,r,tot:{xp:wallet.xp,coins:wallet.coins},btn:'Play again'}),900));
}
function step(dt){
  vy+=1500*dt;by+=vy*dt;rot=Math.max(-.4,Math.min(.6,vy/800));
  speed=Math.min(240,150+score*2.5);const dx=speed*dt;floorOff=(floorOff+dx)%40;
  for(const o of obs)o.x-=dx;
  for(const c of chil){c.x-=dx;c.y=c.base+Math.sin(t*2.2+c.ph)*c.amp}
  for(const p of pick)p.x-=dx;
  if(!obs.length||obs[obs.length-1].x<W-250)addObs();
  obs=obs.filter(o=>o.x>-100);chil=chil.filter(c=>c.x>-40);pick=pick.filter(p=>p.x>-40&&!p.got);
  for(const o of obs)if(!o.p&&o.x+o.w/2<BX){
    o.p=true;score++;setScore(score);
    pops.push({x:BX+30,y:by-34,t:0,s:'+1'});
    if(score%10===0){theme=(theme+1)%3;toast={s:TH[theme].n,t:0}}
  }
  if(by<18){by=18;vy=0}
  if(by>H-FL-18){by=H-FL-18;loseLayer('floor');if(state!=='play')return;vy=-430}
  if(inv<=0)for(const o of obs){
    const cx=o.x+o.w/2,top=o.cy-o.gap/2,bot=o.cy+o.gap/2;
    if(cr(BX,by,17,cx-7,0,14,top-10)||cr(BX,by,17,cx-29,top-34,58,34)||cr(BX,by,17,o.x-2,bot,o.w+4,H)){
      vy=Math.max(-420,Math.min(420,(o.cy-by)*4));loseLayer('obs');break;
    }
  }
  if(state!=='play')return;
  if(inv<=0)for(const c of chil)if(Math.hypot(BX-c.x,by-c.y)<29){c.x=-999;burst(c.x,c.y,8,['#ff3b30']);loseLayer('chilli');break}
  if(state!=='play')return;
  for(const p of pick)if(!p.got&&Math.hypot(BX-p.x,by-p.y)<33){
    p.got=true;if(lives<3)lives++;burst(p.x,p.y,16,['#ffd25a','#fff','#ffb300']);pops.push({x:BX+30,y:by-34,t:0,s:'+layer!'});
    try{navigator.vibrate&&navigator.vibrate(15)}catch(e){}
  }
}
function drawBurger(){
  const st=lives>=3?['bot','patty','lettuce','top']:lives===2?['bot','patty','top']:['bot','top'];
  const hs={bot:14,patty:13,lettuce:9,top:24};let tot=0;for(const k of st)tot+=hs[k];
  ctx.save();ctx.translate(BX,by);ctx.rotate(state==='dead'?deadT*6:rot);
  if(inv>0&&state==='play')ctx.globalAlpha=Math.sin(t*40)>0?1:.35;
  // wings
  const wa=-.5+Math.sin(t*35)*.55*flapT+Math.sin(t*6)*.1;
  for(const sg of [-1,1]){ctx.save();ctx.translate(sg*27,-2);ctx.rotate(wa*sg*-1+(sg>0?.4:-.4)*0);ctx.fillStyle='rgba(255,255,255,.88)';ctx.beginPath();ctx.ellipse(sg*12,-6,15,7,sg*(-.5+wa*.8),0,6.2832);ctx.fill();ctx.restore()}
  let y=tot/2;
  for(const k of st){
    const h=hs[k];y-=h;
    if(k==='bot'){ctx.fillStyle='#d9954a';ctx.beginPath();ctx.roundRect?ctx.roundRect(-28,y,56,h,7):ctx.rect(-28,y,56,h);ctx.fill()}
    else if(k==='patty'){ctx.fillStyle='#5a2d1b';ctx.beginPath();ctx.roundRect?ctx.roundRect(-29,y,58,h,6):ctx.rect(-29,y,58,h);ctx.fill()}
    else if(k==='lettuce'){ctx.fillStyle='#5fd35f';ctx.beginPath();ctx.moveTo(-31,y+h);for(let i=0;i<=12;i++)ctx.lineTo(-31+i*5.17,y+(i%2?h:2));ctx.lineTo(31,y+h);ctx.fill()}
    else{
      ctx.fillStyle='#ee ab52'.replace(' ','');ctx.beginPath();ctx.ellipse(0,y+h,28,h,0,Math.PI,6.2832);ctx.fill();
      ctx.fillStyle='#fff3c9';for(const [sx,sy] of [[-14,-7],[-3,-13],[9,-8],[16,-3],[-20,-2]]){ctx.beginPath();ctx.ellipse(sx,y+h+sy,2.4,1.3,.5,0,6.2832);ctx.fill()}
      const ey=y+h-9,sc=lives===1||state==='dead';
      for(const sx of [-9,9]){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(sx,ey,sc?4.6:4,0,6.2832);ctx.fill();ctx.fillStyle='#14212b';ctx.beginPath();ctx.arc(sx+1,ey+(vy>200?1.2:0),sc?1.5:2,0,6.2832);ctx.fill()}
    }
  }
  ctx.restore();
}
function drawObs(o){
  const cx=o.x+o.w/2,top=o.cy-o.gap/2,bot=o.cy+o.gap/2;
  let g=ctx.createLinearGradient(cx-7,0,cx+7,0);g.addColorStop(0,'#8996a8');g.addColorStop(.5,'#e2e9f2');g.addColorStop(1,'#7d8a9a');
  ctx.fillStyle=g;ctx.fillRect(cx-7,0,14,top-20);
  ctx.beginPath();ctx.arc(cx,top-34+0,0,0,0);
  g=ctx.createLinearGradient(cx-29,0,cx+29,0);g.addColorStop(0,'#7d8a9a');g.addColorStop(.45,'#e2e9f2');g.addColorStop(1,'#6c7888');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,top-32,30,0,Math.PI);ctx.fill();
  ctx.fillStyle='#aab4c2';ctx.beginPath();ctx.ellipse(cx,top-32,30,6,0,0,6.2832);ctx.fill();
  ctx.fillStyle='#ff9a3c';ctx.fillRect(cx-4,0,8,8);
  let i=0;
  for(let y=bot;y<H-FL;y+=28,i++){
    ctx.fillStyle=i%2?'#3a3f4b':'#4b5262';ctx.beginPath();ctx.roundRect?ctx.roundRect(o.x-2,y,o.w+4,27,6):ctx.rect(o.x-2,y,o.w+4,27);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.18)';ctx.fillRect(o.x+2,y+3,o.w-4,3);
    if(!i){ctx.fillStyle='#7a4a2a';ctx.fillRect(o.x+o.w+2,y+8,28,9)}
  }
}
function draw(){
  const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,`rgb(${cur[0].map(v=>v|0)})`);g.addColorStop(1,`rgb(${cur[1].map(v=>v|0)})`);
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  for(const b of bub){
    const x=b.x*W+Math.sin(t*.6+b.r)*14,y=b.y*H;
    const rg=ctx.createRadialGradient(x,y,0,x,y,b.r*2);rg.addColorStop(0,'rgba(255,255,255,.12)');rg.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=rg;ctx.fillRect(x-b.r*2,y-b.r*2,b.r*4,b.r*4);
  }
  ctx.save();
  if(shake>0)ctx.translate((Math.random()-.5)*10*shake*2,(Math.random()-.5)*10*shake*2);
  for(const o of obs)drawObs(o);
  // floor
  ctx.fillStyle='rgba(8,10,24,.9)';ctx.fillRect(-10,H-FL,W+20,FL+10);
  ctx.fillStyle='rgba(255,170,60,.7)';ctx.fillRect(-10,H-FL,W+20,3);
  ctx.fillStyle='rgba(255,255,255,.08)';for(let x=-floorOff;x<W;x+=40)ctx.fillRect(x,H-FL+8,2,FL);
  ctx.font='28px '+EMO;ctx.textAlign='center';ctx.textBaseline='middle';
  for(const p of pick){if(p.got)continue;const y=p.y+Math.sin(t*4)*4;
    const rg=ctx.createRadialGradient(p.x,y,0,p.x,y,34);rg.addColorStop(0,'rgba(255,210,90,.45)');rg.addColorStop(1,'rgba(255,210,90,0)');ctx.fillStyle=rg;ctx.fillRect(p.x-34,y-34,68,68);
    ctx.fillStyle='#fff';ctx.fillText('🧀',p.x,y)}
  for(const c of chil){
    const rg=ctx.createRadialGradient(c.x,c.y,0,c.x,c.y,32);rg.addColorStop(0,'rgba(255,40,30,.5)');rg.addColorStop(1,'rgba(255,40,30,0)');ctx.fillStyle=rg;ctx.fillRect(c.x-36,c.y-36,72,72);
    ctx.save();ctx.translate(c.x,c.y);ctx.rotate(Math.sin(t*5+c.ph)*.3);ctx.fillStyle='#fff';ctx.fillText('🌶️',0,1);ctx.restore();
  }
  drawBurger();
  for(const p of parts){
    ctx.globalAlpha=Math.max(0,Math.min(1,p.l));ctx.fillStyle=p.c;
    if(p.w){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);ctx.restore()}
    else{ctx.beginPath();ctx.arc(p.x,p.y,p.r*Math.min(1,p.l)+.5,0,6.2832);ctx.fill()}
  }
  ctx.globalAlpha=1;
  ctx.font='800 20px system-ui,sans-serif';ctx.fillStyle='#ffd25a';
  for(const p of pops){ctx.globalAlpha=Math.max(0,1-p.t/.8);ctx.fillText(p.s,p.x,p.y-p.t*50)}
  ctx.globalAlpha=1;
  if(toast){const a=Math.sin(Math.min(1,toast.t/1.8)*Math.PI);ctx.globalAlpha=a;ctx.font='800 30px system-ui,sans-serif';ctx.fillStyle='#fff';ctx.fillText(toast.s,W/2,H*.28-(1-a)*10)}
  if(state==='wait'){ctx.globalAlpha=.6+.4*Math.sin(t*6);ctx.font='800 24px system-ui,sans-serif';ctx.fillStyle='#fff';ctx.fillText('TAP TO FLY',W/2,H*.62);}
  ctx.globalAlpha=1;ctx.restore();
}
let last=0;
function loop(ts){
  DT=Math.min(.033,(ts-last)/1000||0);last=ts;t+=DT;
  for(const b of bub){b.y-=b.s*DT;if(b.y<-.1)b.y=1.1}
  if(state==='play')step(DT);
  else if(state==='wait'||state==='ready')by=H*.45+Math.sin(t*4)*8;
  else if(state==='dead'){deadT+=DT;vy+=1500*DT;by=Math.min(H-FL-18,by+vy*DT)}
  inv=Math.max(0,inv-DT);flapT=Math.max(0,flapT-DT*2.5);shake=Math.max(0,shake-DT);
  for(const p of parts){p.x+=p.vx*DT;p.y+=p.vy*DT;p.vy+=260*DT;p.l-=DT*1.5;if(p.w)p.rot+=p.vr*DT}
  parts=parts.filter(p=>p.l>0);
  for(const p of pops)p.t+=DT;pops=pops.filter(p=>p.t<.8);
  if(toast){toast.t+=DT;if(toast.t>1.8)toast=null}
  const tg=TH[theme||0].c.map(hex);for(let i=0;i<2;i++)for(let k=0;k<3;k++)cur[i][k]+=(tg[i][k]-cur[i][k])*Math.min(1,DT*2);
  draw();raf=requestAnimationFrame(loop);
}
const pd=e=>{e.preventDefault();flap()},kd=e=>{if(e.code==='Space'||e.key==='ArrowUp'){e.preventDefault();flap()}};
cv.addEventListener('pointerdown',pd);window.addEventListener('keydown',kd);
const ro=new ResizeObserver(resize);ro.observe(cv);
startRef.current=()=>{unlockAppSounds(['announced','burgerCrash','burgerTap','coinCollect','gameHit']);setUi(p=>({...p,show:false}));resize();reset();state='wait'};
resize();reset();raf=requestAnimationFrame(loop);
return()=>{cancelAnimationFrame(raf);timers.forEach(clearTimeout);cv.removeEventListener('pointerdown',pd);window.removeEventListener('keydown',kd);ro.disconnect()};

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFs = () => { try { (document.fullscreenElement ? document.exitFullscreen() : rootRef.current.requestFullscreen()).catch(() => {}); } catch (e) {} };
  const canFs = typeof document !== "undefined" && !!document.documentElement.requestFullscreen;

  return (
    <div ref={rootRef} className={"fb-root " + className} style={style}>
      <style>{CSS}</style>
      <canvas ref={cvRef} />
      <div className="fb-hud">
        <div className="fb-chip">Score<b key={score} className="fb-bump">{score}</b></div>
        <div className="fb-chip">Best<b>{best}</b></div>
        <div className="fb-chip">🪙<b>{coins}</b></div>
        {canFs && <button className="fb-fs" aria-label="Fullscreen" onClick={toggleFs}>⛶</button>}
      </div>

      <div className={"fb-ov" + (ui.show ? " fb-show" : "")}>
        <div className="fb-card">
          <div className="fb-snk">🍔</div>
          <h1>{ui.title}</h1>
          <p>{ui.text}</p>
          {ui.r && (
            <div className="fb-rw">
              {(ui.r.xp || ui.r.coins) ? <div>⭐ +{ui.r.xp} XP · 🪙 +{ui.r.coins}</div> : null}
              <div className="fb-tot">Total ⭐ {ui.tot.xp} · 🪙 {ui.tot.coins}</div>
              {ui.r.note && <div className="fb-nt">{ui.r.note}</div>}
            </div>
          )}
          <button className="fb-go" onClick={() => startRef.current()}>{ui.btn}</button>
        </div>
      </div>
    </div>
  );
}
