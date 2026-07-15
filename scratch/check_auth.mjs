import http from 'http';

const req = http.request({
  hostname: 'localhost',
  port: 4000,
  path: '/projects',
  method: 'GET'
}, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data));
});
req.on('error', console.error);
req.end();
