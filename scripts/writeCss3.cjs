const fs = require('fs');
const path = require('path');
const target = path.join(__dirname, '..', 'src', 'index.css');

let css = '';
css += '\n';
css += '.character-card {\n';
css += '  background: linear-gradient(135deg, rgba(16, 20, 38, 0.75), rgba(16, 20, 38, 0.55));\n';
css += '  backdrop-filter: blur(20px) saturate(1.4);\n';
css += '  -webkit-backdrop-filter: blur(20px) saturate(1.4);\n';
css += '  border: 1px solid var(--glass-border);\n';
css += '  box-shadow: var(--glass-shadow), inset 0 1px 0 rgba(255, 255, 255, 0.08);\n';
css += '  border-radius: 22px;\n';
css += '  padding: 0.85rem 1.15rem;\n';
css += '  display: flex;\n';
css += '  align-items: center;\n';
css += '  gap: 0.9rem;\n';
css += '  min-width: 260px;\n';
css += '  max-width: 380px;\n';
css += '  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);\n';
css += '  position: relative;\n';
css += '  overflow: hidden;\n';
css += '}\n';

fs.writeFileSync(target, css);
console.log('Part 3 written');
