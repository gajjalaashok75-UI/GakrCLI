const WebSocket = require('ws');
const token = '378cc0a9a88e7df871c330a4cbf6c445010552db818d3537e0576ede472ad3ed';
const port = 57952;
const origin = 'chrome-extension://galhhbpfeohnjpakdahodhcpnohddjob';

const ws = new WebSocket(`ws://127.0.0.1:${port}?token=${token}`, {
  headers: { origin }
});

ws.on('open', () => {
  console.log('Connected');
  ws.send(JSON.stringify({ type: 'init', cols: 80, rows: 24 }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === 'output') {
    process.stdout.write(msg.data);
  } else {
    console.log(`[${msg.type}]`, JSON.stringify(msg).substring(0, 200));
  }
});

ws.on('error', (err) => console.error('Error:', err.message));
ws.on('close', (code, reason) => console.log(`Closed: ${code}, ${reason.toString()}`));

setTimeout(() => {
  ws.send(JSON.stringify({ type: 'input', data: 'echo hello world\r' }));
}, 1000);

setTimeout(() => ws.close(), 5000);