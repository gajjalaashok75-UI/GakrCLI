const WebSocket = require('ws');
const token = '37923c111025e3e2aa412e584509db906d6dec43c4f87a41db8313cc9339193e';
const port = 56221;
const origin = 'chrome-extension://galhhbpfeohnjpakdahodhcpnohddjob';
const sessionId = 'lifecycle-test-session';

function connect(label, sessionIdOverride) {
  const useSessionId = sessionIdOverride || sessionId;
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}?token=${token}`, {
      headers: { origin }
    });
    let output = '';
    let role = null;
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'init', cols: 80, rows: 24, sessionId: useSessionId }));
    });
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'output') {
        output += msg.data;
      } else if (msg.type === 'attached') {
        role = msg.role;
      } else if (msg.type === 'history') {
        console.log(`[${label}] History replay: ${msg.chunks.length} chunks`);
      }
    });
    ws.on('error', (err) => console.error(`[${label}] Error:`, err.message));
    ws.on('close', (code, reason) => {
      console.log(`[${label}] Closed: ${code}, role: ${role}`);
      resolve({ ws, output, role });
    });
    setTimeout(() => ws.close(), 3000);
  });
}

async function run() {
  console.log('=== Test 1: First connection (creates session) ===');
  const r1 = await connect('First');
  console.log('Output:', r1.output.substring(0, 200));
  
  console.log('\n=== Test 2: Disconnect and wait 1s ===');
  await new Promise(r => setTimeout(r, 1000));
  
  console.log('\n=== Test 3: Reconnect to same session (should replay history) ===');
  const r2 = await connect('Reconnect');
  console.log('Output:', r2.output.substring(0, 200));
  
  console.log('\n=== Test 4: Second client (observer) ===');
  const r3 = await connect('Observer', sessionId);
  console.log('Role:', r3.role);
  
  console.log('\n=== Test 5: Different session ID (new session) ===');
  const r4 = await connect('NewSession', 'different-session-id');
  console.log('Output:', r4.output.substring(0, 200));
  
  console.log('\n=== Done ===');
}

run();