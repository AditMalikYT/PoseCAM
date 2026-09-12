const fs = require('fs');
let c = fs.readFileSync('src/index.css', 'utf8');
c += `
.rep-arc-wrap { position: relative; width: 120px; height: 120px; display: flex; align-items: center; justify-content: center; }
.rep-arc-wrap svg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
.rep-arc-track { fill: none; stroke: rgba(0,243,255,0.08); stroke-width: 4; }
.rep-arc-fill { fill: none; stroke: url(#arcGradient); stroke-width: 4; stroke-linecap: round; transition: stroke-dashoffset 0.5s cubic-bezier(0.4,0,0.2,1); filter: drop-shadow(0 0 6px var(--neon-cyan)); }
.rep-arc-number { position: relative; z-index: 2; font-size: 2.8rem; font-weight: 900; letter-spacing: -1px; background: linear-gradient(180deg, #fff, var(--neon-cyan)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; filter: drop-shadow(0 0 12px rgba(0,243,255,0.4)); }

.phase-indicator {
  display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1.1rem;
  background: rgba(0,243,255,0.06); border: 1px solid rgba(0,243,255,0.2);
  border-radius: 50px; font-size: 0.7rem; font-weight: 800;
  text-transform: uppercase; letter-spacing: 2.5px; color: var(--neon-cyan);
  transition: all 0.4s cubic-bezier(0.4,0,0.2,1);
}
.phase-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--neon-cyan); animation: pulse-glow 1.5s ease-in-out infinite; flex-shrink: 0; }
@keyframes pulse-glow { 0%,100%{opacity:1;box-shadow:0 0 6px var(--neon-cyan),0 0 12px var(--neon-cyan)} 50%{opacity:0.5;box-shadow:0 0 14px var(--neon-cyan),0 0 28px var(--neon-cyan)} }

.workout-state { font-size: 1.4rem; font-weight: 900; text-transform: uppercase; letter-spacing: 5px; color: #fff; text-shadow: 0 0 30px rgba(0,243,255,0.6), 0 0 60px rgba(0,243,255,0.3); transition: all 0.3s; animation: state-pop-in 0.35s cubic-bezier(0.34,1.56,0.64,1); }
@keyframes state-pop-in { 0%{opacity:0;transform:scale(0.8) translateY(10px);filter:blur(4px)} 100%{opacity:1;transform:scale(1) translateY(0);filter:blur(0)} }
.workout-state.ready { color: var(--neon-amber); text-shadow: 0 0 30px rgba(255,170,0,0.6); }
.workout-state.down { color: var(--neon-cyan); }
.workout-state.up { color: var(--neon-green); text-shadow: 0 0 30px rgba(0,255,136,0.6); }
.workout-state.complete { color: var(--neon-gold); text-shadow: 0 0 30px rgba(255,215,0,0.6); }

.hud-bottom { display: flex; flex-direction: column; gap: 0.75rem; align-items: center; }
`;
fs.writeFileSync('src/index.css', c);
console.log('Part 3');
