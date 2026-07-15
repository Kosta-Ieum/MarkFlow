const API_URL = 'http://localhost:4000';

async function runTests() {
  console.log('=== Starting Dynamic Tests ===');

  // 1. Create User A and User B
  const userA = { email: `a_${Date.now()}@test.com`, password: 'Password123!', name: 'User A' };
  const userB = { email: `b_${Date.now()}@test.com`, password: 'Password123!', name: 'User B' };

  let tokenA, tokenB;

  let resA = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userA)
  });
  let dataA = await resA.json();
  tokenA = dataA.accessToken;

  let resB = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userB)
  });
  let dataB = await resB.json();
  tokenB = dataB.accessToken;

  console.log('Created User A and User B');

  // 2. User A creates Project P
  let resP = await fetch(`${API_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ name: 'Test Project P' })
  });
  let dataP = await resP.json();
  console.log('Project create response:', dataP);
  const P = dataP.id;

  console.log(`Created Project P: ${P}`);

  // Create a Node to test node endpoints
  let resNode = await fetch(`${API_URL}/projects/${P}/nodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ type: 'TEXT', x: 0, y: 0, width: 100, height: 100, data: { text: 'test' } })
  });
  let dataNode = await resNode.json();
  const nodeId = dataNode.id;

  // Create an Edge
  let resEdge = await fetch(`${API_URL}/projects/${P}/edges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ source: nodeId, target: nodeId })
  });
  let dataEdge = await resEdge.json();
  const edgeId = dataEdge.id;
  
  const targetUserId = dataB.user.id;

  const endpoints = [
    { method: 'GET', path: `/projects` },
    { method: 'POST', path: `/projects`, body: { title: 'x' } },
    { method: 'PATCH', path: `/projects/${P}`, body: { name: 'y' } },
    { method: 'DELETE', path: `/projects/${P}` }, // Wait, if I delete it, I can't test others. Let's do it last. Wait, I will use a dummy project for DELETE or do it at the end. I'll test DELETE with B first, it should 403, so it won't delete it.
    { method: 'GET', path: `/projects/${P}/canvas` },
    { method: 'PUT', path: `/projects/${P}/canvas`, body: { nodes: [], edges: [] } },
    { method: 'GET', path: `/projects/${P}/trash` },
    { method: 'POST', path: `/projects/${P}/nodes`, body: { type: 'TEXT', x: 0, y: 0, width: 100, height: 100, data: {} } },
    { method: 'PATCH', path: `/projects/${P}/nodes/${nodeId}`, body: { x: 10 } },
    { method: 'DELETE', path: `/projects/${P}/nodes/${nodeId}` },
    { method: 'POST', path: `/projects/${P}/nodes/${nodeId}/restore` },
    { method: 'DELETE', path: `/projects/${P}/nodes/${nodeId}/permanent` },
    { method: 'POST', path: `/projects/${P}/edges`, body: { source: nodeId, target: nodeId } },
    { method: 'DELETE', path: `/projects/${P}/edges/${edgeId}` },
    { method: 'GET', path: `/projects/${P}/messages` },
    { method: 'POST', path: `/projects/${P}/messages`, body: { content: 'test' } },
    { method: 'GET', path: `/projects/${P}/history` },
    { method: 'GET', path: `/projects/${P}/nodes/${nodeId}/history` },
    { method: 'GET', path: `/projects/${P}/members` },
    { method: 'POST', path: `/projects/${P}/members`, body: { email: userB.email, role: 'EDITOR' } },
    { method: 'PATCH', path: `/projects/${P}/members/${targetUserId}`, body: { role: 'VIEWER' } },
    { method: 'DELETE', path: `/projects/${P}/members/${targetUserId}` },
  ];

  console.log('\n--- B-1: Token-less Test ---');
  for (const ep of endpoints) {
    const res = await fetch(`${API_URL}${ep.path}`, {
      method: ep.method,
      headers: ep.body ? { 'Content-Type': 'application/json' } : {},
      body: ep.body ? JSON.stringify(ep.body) : undefined
    });
    console.log(`[B-1] ${ep.method.padEnd(6)} ${ep.path.padEnd(50)} -> ${res.status}`);
  }

  console.log('\n--- B-2: Non-member Test (User B on Project P) ---');
  for (const ep of endpoints) {
    const res = await fetch(`${API_URL}${ep.path}`, {
      method: ep.method,
      headers: { 
        'Authorization': `Bearer ${tokenB}`,
        ...(ep.body ? { 'Content-Type': 'application/json' } : {})
      },
      body: ep.body ? JSON.stringify(ep.body) : undefined
    });
    console.log(`[B-2] ${ep.method.padEnd(6)} ${ep.path.padEnd(50)} -> ${res.status}`);
  }

  console.log('\n--- C: PUT /canvas 500 Error Diagnosis ---');
  // Send with Token A (Owner) to actually hit the logic, not just 403
  const resC = await fetch(`${API_URL}/projects/${P}/canvas`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ 
      nodes: [], 
      edges: [{ 
        id: '2cf5f76b-9c60-4497-8c4b-3d607e0b5d92', 
        source: '8b9d88cc-8d2b-42fa-acb5-eb12cc2bc9e2', 
        target: '407d57be-00b8-4c91-b6a6-f28a7e0a2db0' 
      }] 
    }) // Valid edge but source/target nodes don't exist
  });
  console.log(`[C] PUT /projects/${P}/canvas -> ${resC.status}`);
  if (resC.status === 500) {
    console.log(await resC.text());
  }
}

runTests().catch(console.error);
