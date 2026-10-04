"use client";
/**
 * QuickMath  (EAT60 game component): 2-minute math sprint with auto-check keypad.
 *
 * Usage:  <div style={{ height: "100dvh" }}><QuickMath onGameEnd={(r) => saveToServer(r)} /></div>
 *
 * Props
 *   onGameEnd(result)  {score, wrong, accuracy, bestStreak, xp, coins, note, totals:{xp,coins}}  when time is up.
 *                      Save it to your backend and VALIDATE + CAP XP/coins on the SERVER too.
 *   config             overrides: DURATION, XP_PER_POINT, XP_MAX_PER_PLAY, XP_PLAYS_PER_DAY, COINS_PER_PLAY, DAILY_COIN_CAP, MIN_SCORE_VALID
 *   storageKey         localStorage prefix for the demo wallet (default "qm")
 * The parent element must have a height.
 */
import { useEffect, useRef, useState } from "react";
import { playAppSound, unlockAppSounds } from "../../../lib/sounds";

const CSS = `
.qm-root{position:relative;width:100%;height:100%;overflow:hidden;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);background:linear-gradient(180deg,#1b0f3a,#071a33);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;touch-action:manipulation;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
.qm-root{position:relative;height:100%;width:100%;display:flex;flex-direction:column;overflow:hidden}.qm-root .qm-glow{position:absolute;border-radius:50%;filter:blur(60px);opacity:.35;pointer-events:none;animation:qmfl 9s ease-in-out infinite}.qm-root .qm-g1{width:220px;height:220px;background:#ff6b2c;left:-60px;top:20%}.qm-root .qm-g2{width:260px;height:260px;background:#6a3dff;right:-80px;bottom:25%;animation-delay:-4s}
@keyframes qmfl{50%{transform:translate(30px,-40px) scale(1.15)}}.qm-root .qm-hud{position:relative;display:flex;gap:8px;align-items:center;padding:10px 12px 0}.qm-root .qm-chip{padding:6px 10px;border-radius:16px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);backdrop-filter:blur(6px);font-size:11px;letter-spacing:.05em;text-transform:uppercase}.qm-root .qm-chip b{display:inline-block;font-size:18px;margin-left:5px;letter-spacing:0;text-transform:none}.qm-root .qm-bump{animation:qmbump .3s ease-out}
@keyframes qmbump{50%{transform:scale(1.4);color:#3dff9a}}.qm-root .qm-fs{margin-left:auto;width:38px;height:38px;border-radius:14px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.1);color:#fff;font-size:18px;padding:0}.qm-root .qm-bar{position:relative;margin:10px 12px 0;height:7px;border-radius:7px;background:rgba(255,255,255,.12);overflow:hidden}.qm-root .qm-barf{display:block;height:100%;width:100%;border-radius:7px;background:linear-gradient(90deg,#3dff9a,#ffd25a);transition:background .4s}.qm-root .qm-bar.qm-low .qm-barf{background:linear-gradient(90deg,#ff4d4d,#ff9a3c);animation:qmpulse .6s infinite}.qm-root .qm-qwrap{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;min-height:0}.qm-root .qm-qtag{padding:5px 14px;border-radius:14px;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#ffd9b0;background:rgba(255,120,40,.18);border:1px solid rgba(255,150,60,.45)}.qm-root .qm-q{min-width:min(78%,300px);padding:22px 28px;border-radius:28px;background:linear-gradient(160deg,rgba(255,255,255,.14),rgba(255,255,255,.04));border:1px solid rgba(255,255,255,.2);backdrop-filter:blur(8px);box-shadow:0 12px 40px rgba(106,61,255,.3);font-weight:800;text-align:center;box-sizing:border-box}.qm-root .qm-q:empty{visibility:hidden}.qm-root .qm-one{font-size:clamp(34px,10vw,50px);line-height:1.2}.qm-root .qm-stk{display:inline-block;font-size:clamp(34px,10vw,48px);line-height:1.3;font-variant-numeric:tabular-nums}.qm-root .qm-stk::after{content:"";display:block;height:3px;margin-top:8px;border-radius:3px;background:rgba(255,255,255,.45)}.qm-root .qm-r{display:flex;align-items:center;justify-content:space-between;gap:22px}.qm-root .qm-r .qm-op{width:30px;text-align:left;color:#ffa23f}.qm-root .qm-r .qm-n{text-align:right}.qm-root .qm-q.qm-qin{animation:qmqin .28s cubic-bezier(.2,1.3,.4,1)}
@keyframes qmqin{0%{opacity:0;transform:translateY(22px) scale(.92)}100%{opacity:1;transform:none}}.qm-root .qm-st{min-height:24px;font-size:14px;font-weight:700;color:#ffb35a}.qm-root .qm-cd{position:absolute;font-size:84px;font-weight:900;color:#ffd25a;text-shadow:0 0 30px rgba(255,150,40,.8);pointer-events:none}.qm-root .qm-cd.qm-pop{animation:qmcdp .65s ease-out}
@keyframes qmcdp{0%{opacity:0;transform:scale(2.2)}30%{opacity:1}100%{opacity:.9;transform:scale(1)}}.qm-root .qm-ans{align-self:center;width:min(86%,360px);height:58px;border-radius:18px;display:grid;place-items:center;font-size:30px;font-weight:800;letter-spacing:.08em;background:rgba(255,255,255,.08);border:2px solid rgba(255,255,255,.2);backdrop-filter:blur(6px);transition:background .15s,border-color .15s}.qm-root .qm-ans.qm-ph{font-size:16px;font-weight:500;letter-spacing:.02em;opacity:.55}.qm-root .qm-ans.qm-ok{background:rgba(61,255,154,.22);border-color:#3dff9a;box-shadow:0 0 22px rgba(61,255,154,.5)}.qm-root .qm-ans.qm-bad{background:rgba(255,77,77,.25);border-color:#ff4d4d;box-shadow:0 0 22px rgba(255,77,77,.55);animation:qmshk .35s}
@keyframes qmshk{20%,60%{transform:translateX(-9px)}40%,80%{transform:translateX(9px)}}.qm-root .qm-skip{align-self:center;margin:8px 0 6px;padding:6px 16px;border-radius:14px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);color:#fff;font-size:13px}.qm-root .qm-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:0 14px 14px;width:100%;max-width:420px;margin:0 auto;box-sizing:border-box}.qm-root .qm-k{position:relative;overflow:hidden;height:clamp(50px,8vh,64px);border-radius:18px;font-size:24px;font-weight:700;color:#fff;padding:0;border:1px solid rgba(255,255,255,.22);background:linear-gradient(160deg,rgba(255,255,255,.2),rgba(255,255,255,.06));backdrop-filter:blur(6px)}.qm-root .qm-k::after{content:"";position:absolute;inset:0;border-radius:inherit;background:radial-gradient(circle,rgba(255,255,255,.7),transparent 60%);opacity:0}.qm-root .qm-k.qm-pr{animation:qmtap .2s ease-out}.qm-root .qm-k.qm-pr::after{animation:qmrip .4s ease-out}.qm-root .qm-k.qm-fn{background:linear-gradient(160deg,rgba(255,150,60,.35),rgba(255,90,30,.18))}
@keyframes qmtap{50%{transform:scale(.88)}}
@keyframes qmrip{0%{opacity:.9;transform:scale(.3)}100%{opacity:0;transform:scale(1.7)}}.qm-root .qm-ov{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(5,8,25,.6);backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity .35s;z-index:5}.qm-root .qm-ov.qm-show{opacity:1;pointer-events:auto}.qm-root .qm-card{width:min(88%,360px);text-align:center;padding:24px 22px;border-radius:28px;background:linear-gradient(160deg,rgba(255,255,255,.16),rgba(255,255,255,.05));border:1px solid rgba(255,255,255,.22);transform:translateY(24px) scale(.9);transition:transform .45s cubic-bezier(.2,1.4,.4,1)}.qm-root .qm-show .qm-card{transform:none}.qm-root .qm-snk{font-size:52px;display:inline-block;animation:qmwig 1.4s ease-in-out infinite}
@keyframes qmwig{0%,100%{transform:rotate(-8deg) translateY(0)}50%{transform:rotate(8deg) translateY(-8px)}}.qm-root h1{margin:6px 0 4px;font-size:28px}.qm-root p{margin:0 0 14px;opacity:.8;font-size:14px}.qm-root .qm-tc{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:16px}.qm-root .qm-t{padding:6px 11px;border-radius:12px;font-size:13px;font-weight:700;color:#fff;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);opacity:.5;transition:all .2s}.qm-root .qm-t.qm-on{opacity:1;background:linear-gradient(160deg,#ffa23f,#ff5a1f);border-color:transparent}.qm-root .qm-rw{margin:-4px 0 14px;font-size:15px;line-height:1.8;font-weight:600}.qm-root .qm-rw .qm-tot{opacity:.75;font-weight:500;font-size:13px}.qm-root .qm-rw .qm-nt{color:#ffb35a;font-size:12px;font-weight:500}.qm-root .qm-go{border:0;border-radius:18px;padding:14px 34px;font-size:17px;font-weight:700;color:#fff;background:linear-gradient(160deg,#ffa23f,#ff4d1f);box-shadow:0 8px 24px rgba(255,90,30,.45);animation:qmpulse 1.6s ease-in-out infinite}
@keyframes qmpulse{50%{transform:scale(1.06)}}`;
const DEFAULTS = { DURATION: 120, XP_PER_POINT: 2, XP_MAX_PER_PLAY: 60, XP_PLAYS_PER_DAY: 7, COINS_PER_PLAY: 25, DAILY_COIN_CAP: 200, MIN_SCORE_VALID: 5 };
const ri=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const gcd=(a,b)=>b?gcd(b,a%b):a;
const TYPES=[['add','+','Addition'],['sub','−','Subtraction'],['mul','×','Multiply'],['div','÷','Division'],['sqr','x²','Square'],['sqrt','√','Square root'],['mod','mod','Remainder'],['lcm','LCM','LCM'],['hcf','HCF','HCF']];

function gen(ty,l){
  switch(ty){
    case'add':{const n=l>=3&&Math.random()<.4?3:2,v=Array.from({length:n},()=>ri(10,20+l*8));return{stack:v.map((x,i)=>[i?'+':'',x]),ans:v.reduce((p,q)=>p+q)}}
    case'sub':{const n=l>=4&&Math.random()<.3?3:2;let r=ri(30,60+l*10);const v=[r];for(let i=1;i<n;i++){const x=ri(5,Math.max(6,Math.floor(r/(n-i+1))));v.push(x);r-=x}return{stack:v.map((x,i)=>[i?'−':'',x]),ans:r}}
    case'mul':{const a=ri(2,9),b=ri(2,9+(l>=3?2:0));return{one:a+' × '+b,ans:a*b}}
    case'div':{const b=ri(2,9),q=ri(2,10+l*2);return{one:b*q+' ÷ '+b,ans:q}}
    case'sqr':{const n=ri(2,10+l);return{one:n+'²',ans:n*n}}
    case'sqrt':{const n=ri(2,10+l);return{one:'√'+n*n,ans:n}}
    case'mod':{const b=ri(3,8+l);let a;do a=ri(b+1,30+l*8);while(a%b===0);return{one:a+' mod '+b,ans:a%b}}
    case'lcm':{const x=ri(2,8+l);let y=ri(2,8+l);if(y===x)y++;return{one:'LCM('+x+', '+y+')',ans:x*y/gcd(x,y)}}
    default:{const g=ri(2,8),x=ri(2,7);let y=ri(2,7);if(y===x)y=x%7+2;const a=g*x,b=g*y;return{one:'HCF('+a+', '+b+')',ans:gcd(a,b)}}
  }
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"];
const todayKey = () => { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };
const tap = (b) => { try { b.animate([{ transform: "scale(1)" }, { transform: "scale(.86)" }, { transform: "scale(1)" }], { duration: 200 }); b.animate([{ opacity: 0.9, transform: "scale(.3)" }, { opacity: 0, transform: "scale(1.7)" }], { duration: 420, pseudoElement: "::after" }); } catch (e) {} };
function loadWallet(k) { const w = { xp: 0, coins: 0, day: "", plays: 0, xpPlays: 0, coinsToday: 0 }; try { Object.assign(w, JSON.parse(localStorage.getItem(k) || "{}")); } catch (e) {} return w; }
// XP + coin rules in ONE place
function settle(w, score, CFG, key) {
  if (w.day !== todayKey()) { w.day = todayKey(); w.plays = 0; w.xpPlays = 0; w.coinsToday = 0; }
  const r = { score, xp: 0, coins: 0, note: "" };
  if (score >= CFG.MIN_SCORE_VALID) {
    w.plays++;
    if (w.xpPlays < CFG.XP_PLAYS_PER_DAY) { r.xp = Math.min(CFG.XP_MAX_PER_PLAY, score * CFG.XP_PER_POINT); w.xpPlays++; } else r.note = "Daily XP limit reached";
    r.coins = Math.min(CFG.COINS_PER_PLAY, Math.max(0, CFG.DAILY_COIN_CAP - w.coinsToday));
    if (!r.coins) r.note = (r.note ? r.note + " · " : "") + "Daily coin cap reached";
    w.xp += r.xp; w.coins += r.coins; w.coinsToday += r.coins;
  } else r.note = "Solve " + CFG.MIN_SCORE_VALID + "+ to earn rewards";
  try { localStorage.setItem(key, JSON.stringify(w)); } catch (e) {}
  return r;
}

export default function QuickMath({ config, onGameEnd, storageKey = "qm", className = "", style }) {
  const CFG = { ...DEFAULTS, ...(config || {}) };
  const KEYW = storageKey + "_wallet", KEYB = storageKey + "_best";
  const m = useRef({ wallet: null, best: 0, score: 0, wrong: 0, streak: 0, bestStreak: 0, typed: "", cur: null, lastTy: "", lock: false, phase: "ready", endAt: 0, sec: -1, qk: 0, timers: [] });
  const barRef = useRef(null), rootRef = useRef(null), endRef = useRef(onGameEnd), pressRef = useRef(() => {}), finishRef = useRef(() => {});
  endRef.current = onGameEnd;
  const [on, setOn] = useState(() => new Set(TYPES.map((x) => x[0])));
  const onRef = useRef(on); onRef.current = on;
  const [v, setV] = useState({ phase: "ready", score: 0, streak: 0, typed: "", q: null, qk: 0, tag: "", st: "", sec: CFG.DURATION, cd: "", coins: 0, res: null });
  const up = (p) => setV((s) => ({ ...s, ...p }));

  const next = () => {
    const M = m.current, ons = [...onRef.current], pool = ons.filter((x) => x !== M.lastTy), list = pool.length ? pool : ons;
    const ty = list[Math.random() * list.length | 0], lv = Math.min(4, M.score / 6 | 0);
    M.lastTy = ty; M.cur = gen(ty, lv); M.typed = ""; M.qk++;
    up({ q: M.cur, qk: M.qk, typed: "", tag: TYPES.find((x) => x[0] === ty)[2] + " · Lv " + (lv + 1) });
  };
  const check = () => {
    const M = m.current; M.lock = true;
    if (+M.typed === M.cur.ans) {
      M.score++; M.streak++; M.bestStreak = Math.max(M.bestStreak, M.streak);
      up({ score: M.score, streak: M.streak, st: "ok" });
      M.timers.push(setTimeout(() => { M.lock = false; up({ st: "" }); if (M.phase === "play") next(); }, 170));
    } else {
      M.wrong++; M.streak = 0; try { navigator.vibrate && navigator.vibrate(60); } catch (e) {}
      up({ streak: 0, st: "bad" });
      M.timers.push(setTimeout(() => { M.typed = ""; M.lock = false; up({ typed: "", st: "" }); }, 380));
    }
  };
  const press = (k) => {
    const M = m.current; if (M.phase !== "play" || M.lock) return;
    const len = String(M.cur.ans).length;
    if (k === "C") M.typed = ""; else if (k === "⌫") M.typed = M.typed.slice(0, -1); else if (M.typed.length < len) M.typed += k;
    up({ typed: M.typed });
    if (M.typed.length === len) check();
  };
  pressRef.current = press;
  const finish = () => {
    const M = m.current; if (M.phase !== "play") return;
    M.phase = "over"; M.lock = true;
    if (M.score > M.best) { M.best = M.score; try { localStorage.setItem(KEYB, M.best); } catch (e) {} }
    const r = settle(M.wallet, M.score, CFG, KEYW), acc = M.score + M.wrong ? Math.round(M.score / (M.score + M.wrong) * 100) : 0;
    if(r.coins>0)playAppSound('coinCollect',0.65);
    try { navigator.vibrate && navigator.vibrate([50, 40, 50]); } catch (e) {}
    const tot = { xp: M.wallet.xp, coins: M.wallet.coins };
    up({ phase: "over", coins: tot.coins });
    if (endRef.current) try { endRef.current({ score: M.score, wrong: M.wrong, accuracy: acc, bestStreak: M.bestStreak, xp: r.xp, coins: r.coins, note: r.note, totals: tot }); } catch (e) {}
    M.timers.push(setTimeout(() => up({ res: { r, acc, bs: M.bestStreak, tot, best: M.best, score: M.score } }), 600));
  };
  finishRef.current = finish;
  const start = () => {
    unlockAppSounds(['announced','coinCollect']);
    const M = m.current; M.timers.forEach(clearTimeout); M.timers = [];
    Object.assign(M, { score: 0, wrong: 0, streak: 0, bestStreak: 0, typed: "", lock: false, phase: "count", sec: -1 });
    up({ phase: "count", score: 0, streak: 0, typed: "", q: null, tag: "Get ready", st: "", sec: CFG.DURATION, res: null });
    let n = 3;
    const tick = () => {
      if (n > 0) { up({ cd: String(n--) }); M.timers.push(setTimeout(tick, 650)); }
      else { up({ cd: "GO!" }); M.timers.push(setTimeout(() => { M.phase = "play"; M.endAt = performance.now() + CFG.DURATION * 1000; up({ cd: "", phase: "play" }); next(); }, 450)); }
    };
    tick();
  };
  const skip = () => { const M = m.current; if (M.phase === "play" && !M.lock) { M.streak = 0; up({ streak: 0 }); next(); } };
  const toggle = (id) => setOn((p) => { const n = new Set(p); if (n.has(id)) { if (n.size > 1) n.delete(id); } else n.add(id); return n; });

  useEffect(() => {
    const M = m.current; M.wallet = loadWallet(KEYW);
    try { M.best = +localStorage.getItem(KEYB) || 0; } catch (e) {}
    up({ coins: M.wallet.coins });
    const kd = (e) => { if (/^[0-9]$/.test(e.key)) pressRef.current(e.key); else if (e.key === "Backspace") pressRef.current("⌫"); else if (e.key === "Escape") pressRef.current("C"); };
    window.addEventListener("keydown", kd);
    return () => { window.removeEventListener("keydown", kd); M.timers.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (v.phase !== "play") return;
    let raf;
    const loop = (now) => {
      const M = m.current, rem = Math.max(0, M.endAt - now);
      if (barRef.current) barRef.current.style.width = (rem / (CFG.DURATION * 1000)) * 100 + "%";
      const s = Math.ceil(rem / 1000); if (s !== M.sec) { M.sec = s; up({ sec: s }); }
      if (rem <= 0) { finishRef.current(); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.phase]);

  const toggleFs = () => { try { (document.fullscreenElement ? document.exitFullscreen() : rootRef.current.requestFullscreen()).catch(() => {}); } catch (e) {} };
  const canFs = typeof document !== "undefined" && !!document.documentElement.requestFullscreen;
  const res = v.res, show = v.phase === "ready" || (v.phase === "over" && !!res), q = v.q;

  return (
    <div ref={rootRef} className={"qm-root " + className} style={style}>
      <style>{CSS}</style>
      <div className="qm-glow qm-g1" /><div className="qm-glow qm-g2" />
      <div className="qm-hud">
        <div className="qm-chip">⏱<b>{Math.floor(v.sec / 60) + ":" + String(v.sec % 60).padStart(2, "0")}</b></div>
        <div className="qm-chip">Solved<b key={v.score} className="qm-bump">{v.score}</b></div>
        <div className="qm-chip">🪙<b>{v.coins}</b></div>
        {canFs && <button className="qm-fs" aria-label="Fullscreen" onClick={toggleFs}>⛶</button>}
      </div>
      <div className={"qm-bar" + (v.phase === "play" && v.sec <= 10 ? " qm-low" : "")}><i ref={barRef} className="qm-barf" /></div>
      <div className="qm-qwrap">
        <div className="qm-qtag">{v.tag}</div>
        <div className="qm-q qm-qin" key={v.qk}>
          {q ? (q.stack
            ? <div className="qm-stk">{q.stack.map(([o, n], i) => <div className="qm-r" key={i}><span className="qm-op">{o}</span><span className="qm-n">{n}</span></div>)}</div>
            : <div className="qm-one">{q.one}</div>) : null}
        </div>
        {v.cd && <div className="qm-cd qm-pop" key={v.cd}>{v.cd}</div>}
        <div className="qm-st">{v.streak >= 3 ? "🔥 " + v.streak + " in a row" : ""}</div>
      </div>
      <div className={"qm-ans" + (!v.typed ? " qm-ph" : "") + (v.st ? " qm-" + v.st : "")}>{v.typed || "Enter Answer"}</div>
      <button className="qm-skip" onClick={skip}>Skip ⏭</button>
      <div className="qm-pad">
        {KEYS.map((k) => (
          <button key={k} className={"qm-k" + (k === "C" || k === "⌫" ? " qm-fn" : "")} onPointerDown={(e) => { e.preventDefault(); tap(e.currentTarget); press(k); }}>{k}</button>
        ))}
      </div>
      <div className={"qm-ov" + (show ? " qm-show" : "")}>
        <div className="qm-card">
          <div className="qm-snk">🧮</div>
          <h1>{res ? "Time's up! ⏱" : "Quick Math"}</h1>
          <p>{res ? "Solved " + res.score + " · Accuracy " + res.acc + "% · Best streak " + res.bs : "Solve as many as you can in 2 minutes. Answers check automatically!"}</p>
          <div className="qm-tc">{TYPES.map(([id, lb]) => <button key={id} className={"qm-t" + (on.has(id) ? " qm-on" : "")} onClick={() => toggle(id)}>{lb}</button>)}</div>
          {res && (
            <div className="qm-rw">
              {(res.r.xp || res.r.coins) ? <div>⭐ +{res.r.xp} XP · 🪙 +{res.r.coins}</div> : null}
              <div className="qm-tot">Total ⭐ {res.tot.xp} · 🪙 {res.tot.coins} · Best {res.best}</div>
              {res.r.note && <div className="qm-nt">{res.r.note}</div>}
            </div>
          )}
          <button className="qm-go" onClick={start}>{res ? "Play again" : "Play"}</button>
        </div>
      </div>
    </div>
  );
}
