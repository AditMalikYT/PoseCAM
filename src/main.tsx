import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Reduce noisy dev-only logs from MediaPipe/WASM and React DevTools.
if (import.meta.env.DEV) {
  const ignored = [
    'Download the React DevTools',
    'OpenGL error checking is disabled',
    'Graph successfully started running.',
    'Successfully created a WebGL context',
    'gl_context.cc:',
    'gl_context_webgl.cc:',
    'vision_wasm_internal.js:',
    'I0000 ',
    'W0000 ',
  ];
  const isIgnored = (message: string) => ignored.some((pattern) => message.includes(pattern));
  const original = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    debug: console.debug,
  };
  console.log = (...args) => {
    if (!isIgnored(args.join(' '))) original.log(...args);
  };
  console.info = (...args) => {
    if (!isIgnored(args.join(' '))) original.info(...args);
  };
  console.warn = (...args) => {
    if (!isIgnored(args.join(' '))) original.warn(...args);
  };
  console.debug = (...args) => {
    if (!isIgnored(args.join(' '))) original.debug(...args);
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
