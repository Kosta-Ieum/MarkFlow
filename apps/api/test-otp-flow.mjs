import { PrismaClient } from './node_modules/@prisma/client/index.js';

const BASE_URL = 'http://localhost:4000/api';

async function fetchApi(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, options);
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text), headers: res.headers };
  } catch(e) {
    return { status: res.status, data: text, headers: res.headers };
  }
}

async function run() {
  console.log("=== 1. Login (Set-Cookie check) ===");
  // Create a user first so we can login
  const emailLogin = `user-${Date.now()}@example.com`;
  const password = 'Password123!';
  
  await fetchApi('/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: emailLogin, password, name: 'Login Test' })
  });
  
  const loginRes = await fetchApi('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: emailLogin, password })
  });
  console.log(`Login Status: ${loginRes.status}`);
  const setCookie = loginRes.headers.get('set-cookie');
  console.log(`Set-Cookie header present: ${!!setCookie}`);
  if (setCookie) {
    console.log(`Set-Cookie value: ${setCookie.substring(0, 50)}...`);
  }

  console.log("\n=== 2. OTP 발송 (send-code) ===");
  const emailOtp = `otp-${Date.now()}@example.com`;
  const sendRes = await fetchApi('/auth/email/send-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: emailOtp })
  });
  console.log(`Send Code Status: ${sendRes.status}`);
  console.log(`Send Code Response:`, sendRes.data);

  console.log("\n=== 3. OTP 검증 (verify) ===");
  // Fetch code from DB
  const prisma = new PrismaClient();
  const record = await prisma.emailVerification.findFirst({
    where: { email: emailOtp },
    orderBy: { createdAt: 'desc' }
  });
  
  if (!record) {
    console.error("Could not find OTP code in DB.");
    await prisma.$disconnect();
    return;
  }
  
  const code = record.code;
  console.log(`Retrieved code from DB: ${code}`);
  
  const verifyRes = await fetchApi('/auth/email/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: emailOtp, code })
  });
  console.log(`Verify Status: ${verifyRes.status}`);
  console.log(`Verify Response:`, verifyRes.data);
  
  await prisma.$disconnect();

  console.log("\n=== 4. Health Check ===");
  const healthRes = await fetchApi('/health');
  console.log(`Health Status: ${healthRes.status}`);
  console.log(`Health Response:`, healthRes.data);
}

run().catch(console.error);
