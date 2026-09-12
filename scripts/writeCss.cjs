const fs = require('fs');
const path = require('path');
const target = path.join(__dirname, '..', 'src', 'index.css');
let css = '';
css += ':root { --font-primary: \'Outfit\', sans-serif; --bg-dark: #070913; --bg-card: rgba(16,20,38,0.65); --glass-border: rgba(255,255,255,0.12); --glass-shadow: 0 8px 32px rgba(0,0,0,0.45); --neon-cyan: #00f3ff; --neon-blue: #3b82f6; --neon-purple: #9d4edd; --neon-gold: #ffd700; --neon-green: #00ff88; --neon-red: #ff2a6d; --neon-amber: #ffaa00; --text-main: #f8fafc; --text-muted: #94a3b8; }\n';
css += '* { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }\n';
fs.writeFileSync(target, css);
console.log('done');
