const fs = require('fs');
const filePath = 'src/utils/threeScene.ts';
let c = fs.readFileSync(filePath, 'utf8');

const startMarker = '  // WebXR feature detection';
const endMarker = '  const ambientLight';
const startIdx = c.indexOf(startMarker);
const endIdx = c.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.log('Markers not found. Start:', startIdx, 'End:', endIdx);
  process.exit(1);
}

const newSection = `  // WebXR feature detection — silent check, no warning banners
  let xrSupported = false;

  try {
    if (navigator.xr) {
      xrSupported = await navigator.xr.isSessionSupported('immersive-ar');
    }
  } catch {
    xrSupported = false;
  }

  // Compact unobtrusive XR button — only rendered when AR is supported
  let xrButton: HTMLElement | null = null;

  if (xrSupported) {
    xrButton = document.createElement('button');
    xrButton.textContent = '\u{1F97D}';
    xrButton.setAttribute('aria-label', 'Enter AR mode');
    xrButton.style.cssText = [
      'position:absolute',
      'bottom:16px',
      'right:16px',
      'z-index:100',
      'width:44px',
      'height:44px',
      'border-radius:50%',
      'border:2px solid rgba(0,243,255,0.5)',
      'background:rgba(16,20,38,0.7)',
      'color:#00f3ff',
      'font-size:1.2rem',
      'cursor:pointer',
      'backdrop-filter:blur(12px)',
      'box-shadow:0 0 15px rgba(0,243,255,0.2)',
      'transition:all .3s ease',
      'display:flex',
      'align-items:center',
      'justify-content:center',
    ].join(';');
    xrButton.addEventListener('click', async () => {
      try {
        const session = await navigator.xr!.requestSession('immersive-ar', {
          requiredFeatures: ['local'],
          optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
          domOverlay: { root: document.body },
        });
        await renderer.xr.setSession(session);
        xrButton!.textContent = '\u2713';
        xrButton!.style.borderColor = '#00ff88';
        xrButton!.style.color = '#00ff88';
      } catch (err) {
        console.warn('[WebXR] AR session failed:', err);
        xrButton!.textContent = '\u2715';
        xrButton!.style.borderColor = '#ff2a6d';
        xrButton!.style.color = '#ff2a6d';
        setTimeout(() => {
          if (xrButton) {
            xrButton.textContent = '\u{1F97D}';
            xrButton.style.borderColor = 'rgba(0,243,255,0.5)';
            xrButton.style.color = '#00f3ff';
          }
        }, 2000);
      }
    });
    document.body.appendChild(xrButton);
  }

  // Expose XR support flag for React state synchronization
  (window as any).__xrSupported = xrSupported;

`;

c = c.substring(0, startIdx) + newSection + c.substring(endIdx);
fs.writeFileSync(filePath, c);
console.log(`Replaced ${endIdx - startIdx} chars with ${newSection.length} chars`);
