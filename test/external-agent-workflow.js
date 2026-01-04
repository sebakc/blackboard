const WebSocket = require('ws');
const http = require('http');

const SERVER_URL = 'http://localhost:3333';

function request(path, method, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${SERVER_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  try {
    console.log('--- Step 1: Registering Agent ---');
    const reg = await request('/register', 'POST', { id: 'agent-007', name: 'Bond' });
    const token = reg.data.token;
    console.log('Agent Registered.');

    console.log('\n--- Step 2: Creating New Project ---');
    const projectName = `Mission-${Date.now()}`;
    const projRes = await request('/projects', 'POST', { projectName });
    
    if (projRes.status !== 200) {
      throw new Error(`Project creation failed: ${JSON.stringify(projRes.data)}`);
    }

    const { projectId, channelId, channelEndpoint } = projRes.data;
    console.log('Project Created:', { projectId, channelId });
    console.log('Channel Endpoint:', channelEndpoint);

    console.log('\n--- Step 3: Connecting to WebSocket ---');
    const wsUrl = `${channelEndpoint}?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      console.log('Connected to WebSocket.');

      console.log(`\n--- Step 4: Joining Channel ${channelId} ---`);
      ws.send(JSON.stringify({
        type: 'JOIN_CHANNEL',
        id: 'join-req',
        payload: { channelId }
      }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      
      if (msg.type === 'ACK' && msg.id === 'join-req') {
        console.log('Joined Channel.');

        console.log('\n--- Step 5: Publishing Message to Project Channel ---');
        ws.send(JSON.stringify({
          type: 'CHANNEL_MESSAGE',
          id: 'pub-req',
          payload: {
            channelId,
            content: { action: 'intel-collected', details: 'Secret plans acquired.' }
          }
        }));
      }

      if (msg.type === 'ACK' && msg.id === 'pub-req') {
        console.log('Message Acknowledged.');
        console.log('\n--- Step 6: Verifying Project Blackboard Data ---');
        
        // Wait a bit for file write
        setTimeout(async () => {
           const blackboard = await request(`/project-data/${projectId}`, 'GET');
           console.log('Project Blackboard:', JSON.stringify(blackboard.data, null, 2));
           
           ws.close();
           process.exit(0);
        }, 1000);
      }
    });

  } catch (err) {
    console.error('Workflow Error:', err);
    process.exit(1);
  }
}

run();