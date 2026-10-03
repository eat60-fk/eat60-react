import { useEffect, useState } from 'react';
import './splash.css';

function splashWasShown() {
  try {
    return sessionStorage.getItem('eat60:splash-shown') === '1';
  } catch {
    return false;
  }
}

export default function SplashScreen({ children }) {
  const [phase, setPhase] = useState(() => splashWasShown() ? 'done' : 'intro');
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (phase === 'done') return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      try { sessionStorage.setItem('eat60:splash-shown', '1'); } catch { /* Storage may be unavailable. */ }
      setPhase('done');
      return undefined;
    }

    const delay = 400;
    const duration = 1100;
    const startedAt = performance.now();
    let frame = 0;
    const animateCount = now => {
      const progress = Math.min(Math.max((now - startedAt - delay) / duration, 0), 1);
      setCount(Math.round((1 - Math.pow(1 - progress, 3)) * 60));
      if (progress < 1) frame = requestAnimationFrame(animateCount);
    };
    frame = requestAnimationFrame(animateCount);

    const zoomTimer = window.setTimeout(() => setPhase('zoom'), 2500);
    const finishTimer = window.setTimeout(() => {
      try { sessionStorage.setItem('eat60:splash-shown', '1'); } catch { /* Storage may be unavailable. */ }
      setPhase('done');
    }, 3300);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(zoomTimer);
      window.clearTimeout(finishTimer);
    };
  }, []);

  return <>
    {phase !== 'done' && <div className={`eat60-splash${phase === 'zoom' ? ' eat60-splash--zoom' : ''}`} aria-label="EAT60 loading" role="status">
      <div className="eat60-splash-mark" aria-hidden="true">
        <span className="eat60-splash-eat">{['E', 'A', 'T'].map((letter, index) => <span key={letter} style={{ '--letter-index': index }}>{letter}</span>)}</span>
        <span className="eat60-splash-number">{String(count).padStart(2, '0')}</span>
      </div>
      <p className="eat60-splash-tagline">BALLIA’S FIRST FOOD DELIVERY APP</p>
      <p className="eat60-splash-powered"><em>POWERED BY</em><strong>FOODVERSE KITCHEN</strong></p>
    </div>}
    <div className={`eat60-app-shell${phase === 'zoom' ? ' eat60-app-shell--in' : ''}${phase === 'intro' ? ' eat60-app-shell--hidden' : ''}`}>
      {children}
    </div>
  </>;
}
