const fs = require('fs');
let c = fs.readFileSync('src/index.css', 'utf8');
c += `
.character-card {
  background: linear-gradient(135deg, rgba(16,20,38,0.75), rgba(16,20,38,0.55));
  backdrop-filter: blur(20px) saturate(1.4); -webkit-backdrop-filter: blur(20px) saturate(1.4);
  border: 1px solid var(--glass-border); box-shadow: var(--glass-shadow), inset 0 1px 0 rgba(255,255,255,0.08);
  border-radius: 22px; padding: 0.85rem 1.15rem; display: flex; align-items: center; gap: 0.9rem;
  min-width: 260px; max-width: 380px; transition: all 0.35s cubic-bezier(0.4,0,0.2,1);
  position: relative; overflow: hidden;
}
.character-card::before, .character-card::after {
  content: ''; position: absolute; width: 18px; height: 18px;
  border-color: var(--neon-cyan); border-style: solid; opacity: 0.6; transition: opacity 0.3s;
}
.character-card::before { top: 6px; left: 6px; border-width: 2px 0 0 2px; }
.character-card::after { bottom: 6px; right: 6px; border-width: 0 2px 2px 0; }
.character-card:hover::before, .character-card:hover::after { opacity: 1; }
`;
fs.writeFileSync('src/index.css', c);
console.log('Part 2a');
