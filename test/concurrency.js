const http = require('http');

function updateData(id, version, content) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: `/project-data/${id}`,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const body = JSON.parse(data);
        if (res.statusCode >= 400) {
          resolve({ success: false, status: res.statusCode, body });
        } else {
          resolve({ success: true, body });
        }
      });
    });
    req.write(JSON.stringify({ version, data: { content } }));
    req.end();
  });
}

function getData(id) {
  return new Promise((resolve) => {
    http.get(`http://localhost:3000/project-data/${id}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
  });
}

async function run() {
  console.log('Starting Concurrency Test...');
  const docId = 'doc-123';
  
  // 1. Initial State
  const initial = await getData(docId);
  console.log('Initial Version:', initial.version); // Should be 0 initially

  // 2. Concurrent Updates
  // Both clients read version 0 and try to update to version 1.
  console.log('Attempting concurrent updates (Race Condition Simulation)...');
  
  const p1 = updateData(docId, initial.version, 'Client A Update');
  const p2 = updateData(docId, initial.version, 'Client B Update');

  const [res1, res2] = await Promise.all([p1, p2]);

  console.log('Client A Result:', res1.status || 200, res1.body.error || 'Success');
  console.log('Client B Result:', res2.status || 200, res2.body.error || 'Success');

  // One should succeed, one should fail with 409
  const successCount = [res1, res2].filter(r => r.success).length;
  const conflictCount = [res1, res2].filter(r => r.status === 409).length;

  console.log(`\nSuccessful Updates: ${successCount}`);
  console.log(`Conflicts Detected: ${conflictCount}`);

  if (successCount === 1 && conflictCount === 1) {
    console.log('PASS: Optimistic locking worked.');
  } else {
    console.log('FAIL: Unexpected result.');
  }

  // 3. Verify Final State
  const final = await getData(docId);
  console.log('\nFinal State:', JSON.stringify(final, null, 2));

  process.exit(0);
}

run();
