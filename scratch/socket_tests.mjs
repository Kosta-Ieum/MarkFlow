import { io } from 'socket.io-client';
const API_URL = 'http://localhost:4000';
const SOCKET_URL = 'ws://localhost:4000';

async function runSocketTests() {
  console.log('=== Starting Socket Tests ===');

  // 1. Create User A and B
  const userA = { email: `sa_${Date.now()}@test.com`, password: 'Password123!', name: 'User A' };
  const userB = { email: `sb_${Date.now()}@test.com`, password: 'Password123!', name: 'User B' };

  const resA = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userA)
  });
  const dataA = await resA.json();
  const tokenA = dataA.accessToken;

  const resB = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userB)
  });
  const dataB = await resB.json();
  const tokenB = dataB.accessToken;

  // 2. User A creates Project P
  const resP = await fetch(`${API_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ name: 'Socket Project P' })
  });
  const dataP = await resP.json();
  const P = dataP.id;
  console.log('Created Project P:', P);

  // Test 1: Token-less connection
  console.log('\\n--- Test 1: Token-less connection ---');
  await new Promise((resolve) => {
    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socket.on('connect_error', (err) => {
      console.log('Token-less connect_error:', err.message);
      socket.disconnect();
      resolve();
    });
    socket.on('connect', () => {
      console.log('Token-less connect: SUCCESS (This is a hole!)');
      socket.disconnect();
      resolve();
    });
    setTimeout(() => { console.log('Timeout'); resolve(); }, 3000);
  });

  // Test 2: Non-member sync:join
  console.log('\\n--- Test 2: Non-member sync:join ---');
  await new Promise((resolve) => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      auth: { token: tokenB }
    });
    socket.on('connect_error', (err) => {
      console.log('Non-member connect_error:', err.message);
      resolve();
    });
    socket.on('connect', () => {
      console.log('Non-member connect: SUCCESS');
      socket.emit('sync:join', { projectId: P }, (response) => {
        console.log('Non-member sync:join response:', response);
        
        // Test 3: Non-member emit node:add
        console.log('\\n--- Test 3: Non-member node:add ---');
        socket.emit('node:add', { projectId: P, node: { id: 'uuid-here', type: 'TEXT', x: 0, y: 0, width: 100, height: 100, data: {} } }, (res) => {
          console.log('Non-member node:add response:', res);
          socket.disconnect();
          resolve();
        });
      });
    });
    setTimeout(() => { console.log('Timeout'); resolve(); }, 3000);
  });
}

runSocketTests().catch(console.error);
