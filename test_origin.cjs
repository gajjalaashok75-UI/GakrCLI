const WebSocket = require('ws');
const token = '3e461fc2929a79e88496c10e06ca481cea43b0e87693930710461660fec13a46';
const port = 61718;

async function testConnection(label, originHeader, testToken) {
  const useToken = testToken || token;
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}?token=${useToken}`, {
      headers: originHeader ? { origin: originHeader } : {}
    });
    ws.on('open', () => {
      console.log(`[${label}] Connected (unexpected)`);
      ws.close();
      resolve({ success: true, unexpected: true });
    });
    ws.on('message', (data) => {
      console.log(`[${label}] Message:`, data.toString());
    });
    ws.on('error', (err) => {
      console.error(`[${label}] Error:`, err.message);
    });
    ws.on('close', (code, reason) => {
      console.log(`[${label}] Closed: ${code}, reason: ${reason.toString()}`);
      resolve({ success: code === 4003 || code === 4001, code, reason: reason.toString() });
    });
    setTimeout(() => { ws.close(); resolve({ success: false, timeout: true }); }, 2000);
  });
}

async function run() {
  console.log('=== Test 1: Valid token, no origin (should warn but allow) ===');
  await testConnection('NoOrigin', undefined);
  
  console.log('=== Test 2: Valid token, invalid origin ===');
  await testConnection('InvalidOrigin', 'chrome-extension://invalid123456789012345678901234');
  
  console.log('=== Test 3: Valid token, valid origin (LOCAL_EXTENSION_ID) ===');
  await testConnection('ValidOrigin', 'chrome-extension://galhhbpfeohnjpakdahodhcpnohddjob');
  
  console.log('=== Test 4: Invalid token ===');
  await testConnection('InvalidToken', 'chrome-extension://galhhbpfeohnjpakdahodhcpnohddjob', 'invalid-token');
  
  console.log('=== Done ===');
}

run();