const WebSocket = require('ws');
const token = '8929ea4890d149156a2c85149aa6319cf15cf3426bc1b83528e20a955989cee0';
const port = 60584;

function testConnection(label, originHeader, testToken) {
  const useToken = testToken || token;
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}?token=${useToken}`, {
      headers: originHeader ? { origin: originHeader } : {}
    });
    let resolved = false;
    ws.on('open', () => {
      if (!resolved) {
        resolved = true;
        console.log(`[${label}] Connected`);
        ws.close();
        resolve({ connected: true });
      }
    });
    ws.on('message', (data) => {
      // Ignore messages for this test
    });
    ws.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        console.error(`[${label}] Error:`, err.message);
        resolve({ error: err.message });
      }
    });
    ws.on('close', (code, reason) => {
      if (!resolved) {
        resolved = true;
        console.log(`[${label}] Closed: ${code}, reason: ${reason.toString()}`);
        resolve({ connected: false, code, reason: reason.toString() });
      }
    });
    setTimeout(() => { if (!resolved) { resolved = true; ws.close(); resolve({ timeout: true }); } }, 2000);
  });
}

async function run() {
  console.log('=== Test 1: Valid token, no origin ===');
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