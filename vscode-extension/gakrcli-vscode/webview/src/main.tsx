import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { vscode } from './vscode';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Signal to the extension host that the webview is ready to receive messages.
// This must happen after React mounts so message listeners are registered.
// Signal shape used by the extension host bridge:
//   vscode.postMessage({ type: 'ready' });
vscode.postMessage({ type: 'ready' });
