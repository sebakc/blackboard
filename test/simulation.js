const WebSocket = require('ws');
const http = require('http');

function getToken(username, name) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3333,
      path: '/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Status: ${res.statusCode}`));
          return;
        }
        resolve(JSON.parse(data).token);
      });
    });
    req.write(JSON.stringify({ username, name }));
    req.end();
  });
}

async function startClient(id, name) {
  const token = await getToken(id, name);
  const ws = new WebSocket(`ws://localhost:3333/ws?token=${token}`);

  return new Promise((resolve) => {
    ws.on('open', () => {
      console.log(`[${id}] Connected as ${name}`);
      resolve(ws);
    });
    
    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.type === 'ERROR') {
        console.log(`[${id}] Error: ${msg.payload.message}`);
      } else if (msg.type === 'ACK' && msg.payload && msg.payload.status === 'JOINED') {
        console.log(`[${id}] Joined: ${msg.payload.channelId}`);
      }
    });
  });
}

async function run() {
  console.log('Starting Project Channel Simulation...');
  
  // Default project 'demo' has members peerA and peerB
  const ws1 = await startClient('peerA', 'Alice');
  const ws2 = await startClient('peerB', 'Bob');
  const ws3 = await startClient('peerC', 'Charlie'); // Not a member

  const projectChannel = 'project-demo-blackboard';

  console.log('--- Attempting to join project channel ---');
  
  ws1.send(JSON.stringify({ type: 'JOIN_CHANNEL', payload: { channelId: projectChannel } }));
  ws2.send(JSON.stringify({ type: 'JOIN_CHANNEL', payload: { channelId: projectChannel } }));
  
  // Expecting failure for Charlie
  ws3.send(JSON.stringify({ type: 'JOIN_CHANNEL', payload: { channelId: projectChannel } }));

  setTimeout(() => {
    process.exit(0);
  }, 2000);
}

run().catch(console.error);