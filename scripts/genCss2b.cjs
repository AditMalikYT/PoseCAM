const fs = require('fs');
let c = fs.readFileSync('src/index.css', 'utf8');
c += `
.character-card:hover { border-color: rgba(0,243,255,0.3); box-shadow: var(--glass-shadow), 0 0 40px rgba(0,243,255,0.12); }
.level-display {
  background: linear-gradient(135deg, var(--neon-cyan), var(--neon-purple));
  border-radius: 14px; padding: 0.45rem 0.75rem; box-shadow: 0 0 15px rgba(0,243,255,0.4); position: relative; flex-shrink: 0;
}
.level-display::after {
  content: ''; position: absolute; inset: -3px; border-radius: 16px;
  background: linear-gradient(135deg, var(--neon-cyan), var(--neon-purple)); opacity: 0.3; filter: blur(8px); z-index: -1;
}
.level-number { font-weight: 900; font-size: 1.15rem; color: #fff; letter-spacing: 0.5px; text-shadow: 0 0 10px rgba(255,255,255,0.5); }
.xp-bar-container { flex: 1; display: flex; flex-direction: column; gap: 0.3rem; min-width: 0; }
.xp-bar-track { width: 100%; height: 8px; background: rgba(0,243,255,0.06); border-radius: 4px; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.6); }
.xp-bar-fill {
  height: 100%; background: linear-gradient(90deg, var(--neon-cyan), var(--neon-blue), var(--neon-purple));
  background-size: 200% 100%; border-radius: 4px; transition: width 0.6s cubic-bezier(0.4,0,0.2,1);
  box-shadow: 0 0 12px var(--neon-cyan); animation: xp-shimmer 2.5s ease-in-out infinite;
}
@keyframes xp-shimmer { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
.xp-bar-label { font-size: 0.65rem; font-weight: 700; color: var(--text-muted); letter-spacing: 0.5px; display: flex; justify-content: space-between; }
.xp-bar-label span:last-child { color: var(--neon-cyan); opacity: 0.8; }
.resource-bar { display: flex; gap: 0.5rem; align-items: center; }
.resource-item { display: flex; align-items: center; gap: 0.3rem; background: rgba(255,215,0,0.06); border: 1px solid rgba(255,215,0,0.2); border-radius: 12px; padding: 0.35rem 0.6rem; font-size: 0.7rem; font-weight: 800; color: var(--neon-gold); letter-spacing: 0.5px; transition: all 0.25s; }
.resource-item:hover { background: rgba(255,215,0,0.12); border-color: rgba(255,215,0,0.4); }
.resource-icon { font-size: 0.9rem; filter: drop-shadow(0 0 4px rgba(255,215,0,0.5)); }
`;
fs.writeFileSync('src/index.css', c);
console.log('Part 2b');
