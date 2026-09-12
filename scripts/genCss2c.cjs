const fs = require('fs');
let c = fs.readFileSync('src/index.css', 'utf8');
c += `
.hud-center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; padding-top: 2rem; }
.rep-counter {
  display: flex; flex-direction: column; align-items: center; gap: 0.4rem; padding: 1.25rem 2.25rem 1rem;
  background: linear-gradient(180deg, rgba(16,20,38,0.7), rgba(16,20,38,0.4));
  backdrop-filter: blur(24px) saturate(1.5); -webkit-backdrop-filter: blur(24px) saturate(1.5);
  border: 1px solid rgba(0,243,255,0.15); border-radius: 28px;
  box-shadow: var(--glass-shadow), 0 0 50px rgba(0,243,255,0.06); transition: all 0.35s; position: relative;
}
.rep-counter::before {
  content: ''; position: absolute; inset: -1px; border-radius: 29px;
  background: conic-gradient(from 0deg, transparent 0%, var(--neon-cyan) 25%, transparent 50%, var(--neon-cyan) 75%, transparent 100%);
  opacity: 0.12; z-index: -1; animation: rotate-border 8s linear infinite;
}
@keyframes rotate-border { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
.rep-counter.rep-pulse { animation: rep-pulse-anim 0.4s ease-out; }
@keyframes rep-pulse-anim { 0%{transform:scale(1)} 30%{transform:scale(1.08);box-shadow:var(--glass-shadow),0 0 80px rgba(0,243,255,0.25)} 100%{transform:scale(1)} }
.rep-counter:hover { border-color: rgba(0,243,255,0.35); box-shadow: var(--glass-shadow), 0 0 70px rgba(0,243,255,0.12); }
.rep-number {
  font-size: 5.5rem; font-weight: 900; line-height: 1; letter-spacing: -3px;
  background: linear-gradient(180deg, #fff 0%, var(--neon-cyan) 60%, var(--neon-blue) 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  filter: drop-shadow(0 0 25px rgba(0,243,255,0.5)) drop-shadow(0 0 50px rgba(0,243,255,0.25));
}
.rep-label { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 4px; color: var(--text-muted); }
.rep-target { font-size: 0.7rem; color: var(--neon-green); font-weight: 700; }
`;
fs.writeFileSync('src/index.css', c);
console.log('Part 2c');
