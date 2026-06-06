import { useState, useEffect, useRef, useCallback } from "react";

const SCENES = [
  { duration: 11, name: "Intro" },
  { duration: 12, name: "Trust" },
  { duration: 14, name: "Product Flow" },
  { duration: 14, name: "AI Match" },
  { duration: 9,  name: "Get Started" },
];
const TOTAL = SCENES.reduce((a, s) => a + s.duration, 0);

function getSceneAt(elapsed: number) {
  let acc = 0;
  for (let i = 0; i < SCENES.length; i++) {
    acc += SCENES[i].duration;
    if (elapsed < acc) return i;
  }
  return SCENES.length - 1;
}
function getSceneStart(idx: number) {
  let acc = 0;
  for (let i = 0; i < idx; i++) acc += SCENES[i].duration;
  return acc;
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
#demo-root{--bg:#020917;--bg1:#060f2a;--card:rgba(14,24,56,0.85);--border:rgba(59,130,246,0.18);--blue:#3b82f6;--blue-g:#60a5fa;--glow:rgba(59,130,246,0.22);--amber:#f59e0b;--emerald:#10b981;--text:#e8f0fe;--muted:#8ca3c8;position:fixed;inset:0;z-index:9999;background:var(--bg);font-family:'Space Grotesk',sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden;display:flex;align-items:center;justify-content:center}
#demo-stars{position:absolute;inset:0;pointer-events:none}
.d-star{position:absolute;border-radius:50%;background:#fff;animation:d-twinkle 4s ease-in-out infinite}
@keyframes d-twinkle{0%,100%{opacity:.15}50%{opacity:.6}}
#demo-spotlight{position:absolute;top:-20%;left:50%;transform:translateX(-50%);width:min(900px,140vw);height:60vh;background:radial-gradient(ellipse at top,rgba(59,130,246,.12) 0%,transparent 70%);pointer-events:none}
#demo-progress{position:absolute;top:0;left:0;height:3px;background:linear-gradient(90deg,#3b82f6,#818cf8,#f59e0b);box-shadow:0 0 8px #3b82f6;transition:width .1s linear;z-index:10}
.d-scene{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1.5rem;opacity:0;pointer-events:none;transition:opacity .6s ease}
.d-scene.d-active{opacity:1;pointer-events:auto}
/* Scene 1 */
.d-badge{display:inline-flex;align-items:center;gap:.45rem;padding:.35rem .9rem;border-radius:999px;border:1px solid rgba(245,158,11,.3);background:rgba(245,158,11,.08);font-size:.75rem;font-weight:600;color:#f59e0b;letter-spacing:.06em;text-transform:uppercase;margin-bottom:1.5rem}
.d-badge-dot{width:6px;height:6px;border-radius:50%;background:#f59e0b;animation:d-pulse 1.8s ease-in-out infinite}
@keyframes d-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.7)}}
.d-h1{font-size:clamp(2rem,7vw,4.2rem);font-weight:700;line-height:1.1;letter-spacing:-.03em;text-align:center;margin-bottom:.5rem}
.d-h1 .l1{background:linear-gradient(135deg,#e8f0fe,#93c5fd 50%,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;display:block}
.d-h1 .l2{background:linear-gradient(135deg,#f59e0b,#fb923c);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;display:block;font-size:.58em}
.d-sub{color:#8ca3c8;font-size:clamp(.9rem,2.5vw,1.1rem);max-width:520px;text-align:center;margin:0 auto 2rem;line-height:1.65}
.d-sub strong{color:#60a5fa;font-weight:600}
.d-btns{display:flex;gap:.85rem;flex-wrap:wrap;justify-content:center;margin-bottom:2rem}
.d-btn-p{padding:.75rem 1.75rem;border-radius:10px;background:#3b82f6;color:#fff;font-family:inherit;font-size:.95rem;font-weight:600;border:none;cursor:pointer;box-shadow:0 0 24px rgba(59,130,246,.4),0 4px 14px rgba(0,0,0,.4);transition:all .25s;position:relative;overflow:hidden}
.d-btn-p::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.12),transparent)}
.d-btn-o{padding:.75rem 1.55rem;border-radius:10px;background:transparent;color:#e8f0fe;font-family:inherit;font-size:.95rem;font-weight:500;border:1.5px solid rgba(59,130,246,.18);cursor:pointer;transition:all .25s}
.d-stats{display:flex;gap:1.2rem;justify-content:center;flex-wrap:wrap}
.d-stat{display:flex;align-items:center;gap:.5rem;padding:.45rem 1rem;border-radius:999px;background:rgba(14,24,56,.9);border:1px solid rgba(59,130,246,.18);font-size:.82rem;font-weight:600;color:#e8f0fe;backdrop-filter:blur(10px)}
.d-stat .n{color:#60a5fa}
/* Stagger helpers */
.d-s1-item{opacity:0;transform:translateY(22px);transition:opacity .55s ease,transform .55s ease}
.d-active .d-s1-item:nth-child(1){opacity:1;transform:none;transition-delay:.1s}
.d-active .d-s1-item:nth-child(2){opacity:1;transform:none;transition-delay:.4s}
.d-active .d-s1-item:nth-child(3){opacity:1;transform:none;transition-delay:.7s}
.d-active .d-s1-item:nth-child(4){opacity:1;transform:none;transition-delay:.95s}
.d-active .d-s1-item:nth-child(5){opacity:1;transform:none;transition-delay:1.2s}
/* Trust */
.d-h2{font-size:clamp(1.4rem,4vw,2.4rem);font-weight:700;letter-spacing:-.025em;text-align:center;background:linear-gradient(135deg,#e8f0fe,#93c5fd);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:.5rem}
.d-head{opacity:0;transform:translateY(18px);transition:opacity .5s,transform .5s}
.d-active .d-head{opacity:1;transform:none;transition-delay:.05s}
.d-trust-sub{color:#8ca3c8;font-size:.95rem;text-align:center;margin-bottom:1.8rem;opacity:0;transition:opacity .5s .2s}
.d-active .d-trust-sub{opacity:1}
.d-trust-grid{display:flex;flex-wrap:wrap;gap:.75rem;justify-content:center;max-width:560px}
.d-chip{display:flex;align-items:center;gap:.55rem;padding:.55rem 1.1rem;border-radius:10px;background:rgba(14,24,56,.85);border:1px solid rgba(59,130,246,.18);font-size:.85rem;font-weight:500;color:#e8f0fe;backdrop-filter:blur(10px);opacity:0;transform:translateY(18px) scale(.95);transition:opacity .45s ease,transform .45s ease}
.d-active .d-chip:nth-child(1){opacity:1;transform:none;transition-delay:.15s}
.d-active .d-chip:nth-child(2){opacity:1;transform:none;transition-delay:.35s}
.d-active .d-chip:nth-child(3){opacity:1;transform:none;transition-delay:.55s}
.d-active .d-chip:nth-child(4){opacity:1;transform:none;transition-delay:.75s}
.d-active .d-chip:nth-child(5){opacity:1;transform:none;transition-delay:.95s}
.d-active .d-chip:nth-child(6){opacity:1;transform:none;transition-delay:1.15s}
.d-tagline{margin-top:1.8rem;font-size:.88rem;color:#8ca3c8;opacity:0;transition:opacity .5s .9s}
.d-active .d-tagline{opacity:1}
.d-tagline strong{color:#e8f0fe}
/* Flow */
.d-flow-h{font-size:clamp(1.3rem,4vw,2.2rem);font-weight:700;letter-spacing:-.02em;text-align:center;margin-bottom:.4rem;opacity:0;transform:translateY(14px);transition:opacity .5s,transform .5s}
.d-active .d-flow-h{opacity:1;transform:none;transition-delay:.05s}
.d-flow-sub{color:#8ca3c8;font-size:.88rem;text-align:center;margin-bottom:1.8rem;opacity:0;transition:opacity .5s .3s}
.d-active .d-flow-sub{opacity:1}
.d-steps{display:flex;align-items:flex-start;justify-content:center;gap:0;max-width:680px;width:100%;flex-wrap:nowrap}
.d-step{flex:1;display:flex;flex-direction:column;align-items:center;gap:.65rem;position:relative;opacity:0;transform:scale(.9) translateY(12px);transition:opacity .5s ease,transform .5s ease}
.d-active .d-step:nth-child(1){opacity:1;transform:none;transition-delay:.3s}
.d-active .d-step:nth-child(2){opacity:1;transform:none;transition-delay:.75s}
.d-active .d-step:nth-child(3){opacity:1;transform:none;transition-delay:1.2s}
.d-connector{position:absolute;top:2.15rem;left:calc(50% + 2.15rem);right:calc(-50% + 2.15rem);height:1.5px;background:linear-gradient(90deg,#3b82f6,rgba(59,130,246,.1));z-index:0}
.d-step:last-child .d-connector{display:none}
.d-ico-wrap{width:4.4rem;height:4.4rem;border-radius:50%;background:rgba(14,24,56,.85);border:1.5px solid rgba(59,130,246,.18);display:flex;align-items:center;justify-content:center;font-size:1.55rem;position:relative;z-index:1;transition:box-shadow .4s,border-color .4s}
.d-step.d-lit .d-ico-wrap{border-color:#3b82f6;box-shadow:0 0 20px rgba(59,130,246,.25),0 0 40px rgba(59,130,246,.1)}
.d-step-num{position:absolute;top:-.3rem;right:-.3rem;width:1.3rem;height:1.3rem;border-radius:50%;background:#3b82f6;font-size:.6rem;font-weight:700;display:flex;align-items:center;justify-content:center;color:#fff}
.d-step-label{font-size:.82rem;font-weight:600;color:#e8f0fe;text-align:center;line-height:1.35}
.d-step-desc{font-size:.72rem;color:#8ca3c8;text-align:center;line-height:1.4;max-width:110px}
.d-step-card{margin-top:.4rem;background:rgba(14,24,56,.85);border:1px solid rgba(59,130,246,.18);border-radius:10px;padding:.65rem .85rem;text-align:left;font-size:.72rem;color:#8ca3c8;width:100%;max-width:148px;backdrop-filter:blur(10px);line-height:1.5}
.d-sc-label{font-size:.62rem;font-weight:600;color:#60a5fa;letter-spacing:.06em;text-transform:uppercase;margin-bottom:.3rem}
.d-sc-row{display:flex;gap:.4rem;align-items:center;margin-bottom:.2rem}
.d-sc-dot{width:5px;height:5px;border-radius:50%;background:#3b82f6;flex-shrink:0}
.d-sc-tag{display:inline-block;padding:.1rem .45rem;border-radius:4px;background:rgba(59,130,246,.12);color:#60a5fa;font-size:.64rem;font-weight:600;margin:.15rem .1rem 0 0}
.d-ai-pulse{display:flex;align-items:center;justify-content:center;gap:.3rem;margin-top:.4rem}
.d-ai-bar{width:3px;border-radius:2px;background:#3b82f6;animation:d-wave 1s ease-in-out infinite}
.d-ai-bar:nth-child(1){height:8px;animation-delay:0s}
.d-ai-bar:nth-child(2){height:14px;animation-delay:.15s}
.d-ai-bar:nth-child(3){height:10px;animation-delay:.3s}
.d-ai-bar:nth-child(4){height:16px;animation-delay:.1s}
.d-ai-bar:nth-child(5){height:8px;animation-delay:.25s}
@keyframes d-wave{0%,100%{transform:scaleY(1);opacity:.7}50%{transform:scaleY(1.4);opacity:1}}
/* Match */
.d-match-h{font-size:clamp(1.1rem,3.5vw,2rem);font-weight:700;letter-spacing:-.02em;text-align:center;margin-bottom:.4rem;opacity:0;transform:translateY(14px);transition:opacity .5s,transform .5s}
.d-active .d-match-h{opacity:1;transform:none;transition-delay:.05s}
.d-match-sub{color:#8ca3c8;font-size:.88rem;text-align:center;margin-bottom:1.2rem;opacity:0;transition:opacity .5s .3s}
.d-active .d-match-sub{opacity:1}
.d-card-wrap{opacity:0;transform:scale(.92) translateY(16px);transition:opacity .55s .4s,transform .55s .4s}
.d-active .d-card-wrap{opacity:1;transform:none}
.d-card{background:rgba(14,24,56,.9);border:1.5px solid rgba(59,130,246,.18);border-radius:18px;padding:1.4rem;max-width:380px;width:100%;backdrop-filter:blur(16px);position:relative;overflow:hidden;transition:box-shadow .6s .9s,border-color .6s .9s}
.d-active .d-card{box-shadow:0 0 60px rgba(59,130,246,.22),0 0 120px rgba(59,130,246,.07);border-color:rgba(59,130,246,.5)}
.d-card::before{content:'';position:absolute;inset:-2px;border-radius:20px;background:linear-gradient(135deg,rgba(59,130,246,.25),transparent 60%,rgba(129,140,248,.15));opacity:0;transition:opacity .6s 1s;z-index:0;pointer-events:none}
.d-active .d-card::before{opacity:1}
.d-card > *{position:relative;z-index:1}
.d-mc-top{display:flex;align-items:center;gap:1rem;margin-bottom:1rem}
.d-mc-av{width:3.2rem;height:3.2rem;border-radius:50%;background:linear-gradient(135deg,#1e3a8a,#3b82f6);display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:700;color:#fff;flex-shrink:0;box-shadow:0 0 18px rgba(59,130,246,.3)}
.d-mc-info{flex:1}
.d-mc-name{font-size:1rem;font-weight:700;display:flex;align-items:center;gap:.4rem;color:#e8f0fe}
.d-mc-badge{width:1.1rem;height:1.1rem;border-radius:50%;background:#3b82f6;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.d-mc-spec{font-size:.78rem;color:#8ca3c8;margin-top:.15rem}
.d-mc-score-wrap{display:flex;flex-direction:column;align-items:center;gap:.15rem;flex-shrink:0}
.d-mc-score{font-size:1.5rem;font-weight:700;color:#60a5fa;font-family:'JetBrains Mono',monospace;line-height:1}
.d-mc-score-lbl{font-size:.6rem;font-weight:600;color:#8ca3c8;letter-spacing:.06em;text-transform:uppercase}
.d-div{height:1px;background:rgba(59,130,246,.18);margin:.8rem 0}
.d-row{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.6rem}
.d-tag{padding:.25rem .65rem;border-radius:6px;font-size:.72rem;font-weight:600;background:rgba(59,130,246,.1);color:#60a5fa;border:1px solid rgba(59,130,246,.2)}
.d-tag.g{background:rgba(16,185,129,.1);color:#34d399;border-color:rgba(16,185,129,.2)}
.d-tag.a{background:rgba(245,158,11,.1);color:#f59e0b;border-color:rgba(245,158,11,.2)}
.d-why{background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.15);border-radius:10px;padding:.7rem .85rem;margin-bottom:.75rem;font-size:.78rem;color:#8ca3c8;line-height:1.55}
.d-why strong{color:#e8f0fe;font-weight:600}
.d-meta{display:flex;gap:1rem;font-size:.78rem;color:#8ca3c8;flex-wrap:wrap;margin-bottom:.85rem}
.d-ctas{display:flex;gap:.65rem}
.d-mc-p{flex:1;padding:.65rem 1rem;border-radius:8px;background:#3b82f6;color:#fff;font-family:inherit;font-size:.82rem;font-weight:600;border:none;cursor:pointer;box-shadow:0 0 16px rgba(59,130,246,.35)}
.d-mc-s{flex:1;padding:.65rem 1rem;border-radius:8px;background:transparent;color:#e8f0fe;font-family:inherit;font-size:.82rem;font-weight:500;border:1.5px solid rgba(59,130,246,.18);cursor:pointer}
/* Final */
.d-final-badge{display:inline-flex;align-items:center;gap:.45rem;padding:.35rem .9rem;border-radius:999px;border:1px solid rgba(16,185,129,.3);background:rgba(16,185,129,.08);font-size:.75rem;font-weight:600;color:#10b981;letter-spacing:.06em;text-transform:uppercase;margin-bottom:1.4rem}
.d-final-h{font-size:clamp(1.8rem,5.5vw,3.4rem);font-weight:700;line-height:1.1;letter-spacing:-.03em;text-align:center;margin-bottom:.7rem}
.d-final-h .l1{background:linear-gradient(135deg,#e8f0fe,#93c5fd,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;display:block}
.d-final-h .l2{background:linear-gradient(135deg,#f59e0b,#fb923c);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;display:block;font-size:.55em}
.d-final-promise{margin-top:1.5rem;font-size:.82rem;color:#8ca3c8;text-align:center}
.d-f5-item{opacity:0;transform:translateY(18px);transition:opacity .5s ease,transform .5s ease}
.d-active .d-f5-item:nth-child(1){opacity:1;transform:none;transition-delay:.1s}
.d-active .d-f5-item:nth-child(2){opacity:1;transform:none;transition-delay:.4s}
.d-active .d-f5-item:nth-child(3){opacity:1;transform:none;transition-delay:.7s}
.d-active .d-f5-item:nth-child(4){opacity:1;transform:none;transition-delay:.95s}
.d-active .d-f5-item:nth-child(5){opacity:1;transform:none;transition-delay:1.2s}
/* Controls */
#demo-controls{position:absolute;bottom:1.75rem;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:.9rem;z-index:20;flex-wrap:wrap;justify-content:center}
.d-dot{width:6px;height:6px;border-radius:50%;background:rgba(140,163,200,.3);transition:all .4s;cursor:pointer}
.d-dot.d-active-dot{background:#3b82f6;box-shadow:0 0 8px #3b82f6;width:18px;border-radius:3px}
.d-dot.d-done{background:rgba(59,130,246,.45)}
#demo-play-btn{display:flex;align-items:center;gap:.5rem;padding:.6rem 1.3rem;border-radius:999px;border:1.5px solid rgba(59,130,246,.18);background:rgba(14,24,56,.9);color:#60a5fa;font-family:inherit;font-size:.83rem;font-weight:600;cursor:pointer;backdrop-filter:blur(12px);transition:all .25s;white-space:nowrap;letter-spacing:.02em}
#demo-play-btn:hover{border-color:#3b82f6;background:rgba(59,130,246,.12);box-shadow:0 0 18px rgba(59,130,246,.22)}
#demo-scene-lbl{font-size:.75rem;color:#8ca3c8;font-weight:500;letter-spacing:.05em;text-transform:uppercase;background:rgba(6,15,42,.8);border:1px solid rgba(59,130,246,.18);padding:.38rem .85rem;border-radius:999px;backdrop-filter:blur(8px)}
/* Exit */
#demo-exit{position:absolute;top:1rem;right:1rem;z-index:20;padding:.4rem .9rem;border-radius:8px;background:rgba(14,24,56,.8);border:1px solid rgba(59,130,246,.18);color:#8ca3c8;font-family:inherit;font-size:.78rem;cursor:pointer;backdrop-filter:blur(10px);transition:all .2s}
#demo-exit:hover{border-color:#3b82f6;color:#e8f0fe}
@media(max-width:600px){
  .d-steps{flex-direction:column;align-items:center;gap:1rem}
  .d-connector{display:none}
  .d-step{width:100%;max-width:260px}
  .d-step-card{max-width:none}
  .d-btns{flex-direction:column;align-items:center}
  .d-stats{gap:.65rem}
}
@media(prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}
`;

export default function Demo() {
  const [scene, setScene] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [litSteps, setLitSteps] = useState<number[]>([]);
  const [scoreVal, setScoreVal] = useState(60);

  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const pausedAtRef = useRef(0);
  const litTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Inject CSS once
  useEffect(() => {
    const el = document.createElement("style");
    el.id = "demo-css";
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, []);

  // Generate stars once
  const starsRef = useRef<React.ReactNode[] | null>(null);
  if (!starsRef.current) {
    starsRef.current = Array.from({ length: 110 }, (_, i) => {
      const sz = Math.random() * 1.8 + 0.4;
      return (
        <div key={i} className="d-star" style={{
          width: sz, height: sz,
          top: `${Math.random() * 100}%`,
          left: `${Math.random() * 100}%`,
          opacity: Math.random() * 0.5 + 0.05,
          animationDelay: `${Math.random() * 5}s`,
          animationDuration: `${3 + Math.random() * 4}s`,
        }} />
      );
    });
  }

  const scoreRef = useRef(false);

  const activateScene = useCallback((idx: number) => {
    setScene(idx);
    if (idx === 3 && !scoreRef.current) {
      scoreRef.current = true;
      let v = 60, target = 94, dur = 1200, start: number | null = null;
      const step = (ts: number) => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / dur, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        setScoreVal(Math.round(v + (target - v) * ease));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    if (idx === 2) {
      litTimersRef.current.forEach(clearTimeout);
      setLitSteps([]);
      litTimersRef.current = [0, 1, 2].map(i =>
        setTimeout(() => setLitSteps(prev => [...prev, i]), (i + 1) * 800)
      );
    }
  }, []);

  const tick = useCallback((ts: number) => {
    if (!startRef.current) startRef.current = ts;
    const elapsed = Math.min((ts - startRef.current + pausedAtRef.current) / 1000, TOTAL);
    const pct = (elapsed / TOTAL) * 100;
    setProgress(pct);
    const idx = getSceneAt(elapsed);
    setScene(prev => { if (prev !== idx) activateScene(idx); return idx; });
    if (elapsed >= TOTAL) {
      setIsPlaying(false);
      setIsDone(true);
      setProgress(100);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [activateScene]);

  const startPlay = useCallback(() => {
    setIsPlaying(true);
    setIsDone(false);
    startRef.current = null;
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const pausePlay = useCallback(() => {
    const now = performance.now();
    const currentElapsed = startRef.current
      ? (now - startRef.current + pausedAtRef.current)
      : pausedAtRef.current;
    pausedAtRef.current = currentElapsed;
    startRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setIsPlaying(false);
  }, []);

  const replay = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    pausedAtRef.current = 0;
    startRef.current = null;
    scoreRef.current = false;
    litTimersRef.current.forEach(clearTimeout);
    setProgress(0);
    setScene(-1);
    setLitSteps([]);
    setScoreVal(60);
    setIsDone(false);
    setTimeout(() => {
      setScene(0);
      startPlay();
    }, 80);
  }, [startPlay]);

  const goToScene = useCallback((idx: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setIsPlaying(false);
    setIsDone(false);
    const elapsed = getSceneStart(idx);
    pausedAtRef.current = elapsed * 1000;
    startRef.current = null;
    setProgress((elapsed / TOTAL) * 100);
    activateScene(idx);
  }, [activateScene]);

  const togglePlay = useCallback(() => {
    if (isDone) { replay(); return; }
    if (isPlaying) { pausePlay(); } else { startPlay(); }
  }, [isDone, isPlaying, pausePlay, startPlay, replay]);

  // Auto-start
  useEffect(() => {
    const t1 = setTimeout(() => { setScene(0); }, 400);
    const t2 = setTimeout(() => { startPlay(); }, 600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [startPlay]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      litTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  const playLabel = isDone ? "Replay Demo" : isPlaying ? "Pause" : "Resume";

  return (
    <div id="demo-root">
      {/* Stars */}
      <div id="demo-stars">{starsRef.current}</div>
      <div id="demo-spotlight" />
      <div id="demo-progress" style={{ width: `${progress}%` }} />

      {/* Exit */}
      <button id="demo-exit" onClick={() => window.history.back()}>← Back</button>

      {/* ── Scene 1: Hero ── */}
      <section className={`d-scene${scene === 0 ? " d-active" : ""}`}>
        <div className="d-s1-item"><div className="d-badge"><span className="d-badge-dot" />Legal AI · Telangana &amp; AP</div></div>
        <h1 className="d-h1 d-s1-item"><span className="l1">Legal Intelligence</span><span className="l2">Built for Telangana &amp; AP</span></h1>
        <p className="d-sub d-s1-item">Post your case. Get <strong>AI-matched</strong> with a verified advocate in minutes.<br />Local expertise. Faster legal help. Built for your courts.</p>
        <div className="d-btns d-s1-item">
          <button className="d-btn-p">Get Started Free</button>
          <button className="d-btn-o">▶&nbsp; Watch 60-sec Demo</button>
        </div>
        <div className="d-stats d-s1-item">
          <div className="d-stat"><span className="n">24/7</span> AI Access</div>
          <div className="d-stat"><span className="n">3</span> AI Models</div>
          <div className="d-stat"><span className="n">100+</span> Advocates</div>
        </div>
      </section>

      {/* ── Scene 2: Trust ── */}
      <section className={`d-scene${scene === 1 ? " d-active" : ""}`}>
        <div className="d-head"><h2 className="d-h2">Trusted from day one</h2></div>
        <p className="d-trust-sub">Everything you need to choose your advocate with confidence.</p>
        <div className="d-trust-grid">
          {[
            ["⭐", <><strong>4.9</strong> avg. rating</>],
            ["👥", <><strong>2,400+</strong> users helped</>],
            ["✅", "Verified advocates only"],
            ["🆓", "Free to start"],
            ["🔒", "Anonymous posting"],
            ["⚡", "Matched in < 2 min"],
          ].map(([ico, label], i) => (
            <div key={i} className="d-chip">
              <span style={{ fontSize: "1.1rem" }}>{ico as string}</span>
              <span>{label as React.ReactNode}</span>
            </div>
          ))}
        </div>
        <p className="d-tagline"><strong>Post your case</strong> · <strong>Get matched in minutes</strong> · <strong>Choose with confidence</strong></p>
      </section>

      {/* ── Scene 3: Product Flow ── */}
      <section className={`d-scene${scene === 2 ? " d-active" : ""}`}>
        <h2 className="d-flow-h">How LitigaForge works</h2>
        <p className="d-flow-sub">Three steps from your problem to the right advocate.</p>
        <div className="d-steps">
          {[
            { icon: "🗂️", label: "Post Your Case", desc: "Describe your issue in seconds",
              card: <><div className="d-sc-label">Case details</div><div className="d-sc-row"><div className="d-sc-dot" />Property dispute · Hyderabad</div><div className="d-sc-row"><div className="d-sc-dot" />Telugu · English</div><div><span className="d-sc-tag">Civil</span><span className="d-sc-tag">₹5k–₹20k</span></div></> },
            { icon: "🤖", label: "AI Analyzes", desc: "Multi-model AI scores every advocate",
              card: <><div className="d-sc-label">AI Processing</div><div className="d-ai-pulse">{[0,1,2,3,4].map(i=><div key={i} className="d-ai-bar" />)}</div><div style={{marginTop:".4rem",fontSize:".67rem",color:"#60a5fa",textAlign:"center"}}>Scoring 100+ advocates…</div></> },
            { icon: "⚖️", label: "Get Matched", desc: "Review scored proposals, choose yours",
              card: <><div className="d-sc-label">Your matches</div><div className="d-sc-row"><div className="d-sc-dot" style={{background:"#10b981"}} />Adv. Priya Sharma · 94%</div><div className="d-sc-row"><div className="d-sc-dot" style={{background:"#60a5fa"}} />Adv. Ravi Kumar · 87%</div><div className="d-sc-row"><div className="d-sc-dot" style={{background:"#818cf8"}} />Adv. Anita Rao · 81%</div></> },
          ].map((step, i) => (
            <div key={i} className={`d-step${litSteps.includes(i) ? " d-lit" : ""}`}>
              {i < 2 && <div className="d-connector" />}
              <div className="d-ico-wrap">{step.icon}<span className="d-step-num">{i + 1}</span></div>
              <div className="d-step-label">{step.label}</div>
              <div className="d-step-desc">{step.desc}</div>
              <div className="d-step-card">{step.card}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Scene 4: AI Match ── */}
      <section className={`d-scene${scene === 3 ? " d-active" : ""}`}>
        <h2 className="d-match-h">Your top match — <span style={{ color: "#60a5fa" }}>{scoreVal}% fit</span></h2>
        <p className="d-match-sub">AI picked the advocate who best fits your case, location &amp; language.</p>
        <div className="d-card-wrap">
          <div className="d-card">
            <div className="d-mc-top">
              <div className="d-mc-av">PS</div>
              <div className="d-mc-info">
                <div className="d-mc-name">
                  Adv. Priya Sharma
                  <div className="d-mc-badge">
                    <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                </div>
                <div className="d-mc-spec">Criminal Law · Hyderabad &nbsp;·&nbsp; 12 yrs exp</div>
              </div>
              <div className="d-mc-score-wrap">
                <div className="d-mc-score">{scoreVal}%</div>
                <div className="d-mc-score-lbl">Match</div>
              </div>
            </div>
            <div className="d-row">
              <span className="d-tag">Criminal Law</span>
              <span className="d-tag">IPC 302–307</span>
              <span className="d-tag g">Available Today</span>
            </div>
            <div className="d-row" style={{ marginBottom: ".7rem" }}>
              <span className="d-tag a">Telugu</span>
              <span className="d-tag a">Hindi</span>
              <span className="d-tag a">English</span>
            </div>
            <div className="d-why"><strong>⚡ Why we matched you:</strong> Priya has defended 80+ criminal cases across Hyderabad courts, is fluent in Telugu, and has strong precedents in IPC sections relevant to your case.</div>
            <div className="d-meta">
              <span>⭐ 4.8 rating</span>
              <span>🕐 Responds in 1 hr</span>
              <span>₹500 / 30 min</span>
            </div>
            <div className="d-ctas">
              <button className="d-mc-p">Connect Now</button>
              <button className="d-mc-s">View Profile</button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Scene 5: Final CTA ── */}
      <section className={`d-scene${scene === 4 ? " d-active" : ""}`}>
        <div className="d-f5-item"><div className="d-final-badge">✦ &nbsp;Start free today</div></div>
        <h2 className="d-final-h d-f5-item"><span className="l1">Your advocate is waiting.</span><span className="l2">Built for Telangana &amp; AP Courts</span></h2>
        <p className="d-sub d-f5-item" style={{ maxWidth: 480 }}>Post your case. Get AI-matched in minutes.<br /><strong style={{ color: "#10b981" }}>First match consultation is free — no credit card required.</strong></p>
        <div className="d-btns d-f5-item">
          <button className="d-btn-p" onClick={() => window.location.href = "/register"}>Get Started Free →</button>
          <button className="d-btn-o" onClick={replay}>▶&nbsp; Replay Demo</button>
        </div>
        <p className="d-final-promise d-f5-item">Verified advocates · Anonymous posting · 100% free to start</p>
      </section>

      {/* ── Controls ── */}
      <div id="demo-controls">
        <div style={{ display: "flex", gap: ".45rem", alignItems: "center" }}>
          {SCENES.map((_, i) => (
            <div key={i}
              className={`d-dot${scene === i ? " d-active-dot" : scene > i ? " d-done" : ""}`}
              onClick={() => goToScene(i)}
              title={SCENES[i].name}
            />
          ))}
        </div>
        <button id="demo-play-btn" onClick={togglePlay}>
          {isPlaying
            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
            : <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          }
          {playLabel}
        </button>
        <div id="demo-scene-lbl">
          {scene >= 0 ? `Scene ${scene + 1} of ${SCENES.length} — ${SCENES[scene]?.name}` : "Scene 1 of 5"}
        </div>
      </div>
    </div>
  );
}
