import fs from 'fs';
import FormData from 'form-data';
import http from 'http';

// Create a small test image buffer (1x1 pixel JPEG)
const testJpeg = Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAACAgBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACv/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AT//Z', 'base64');

const form = new FormData();
form.append('file', testJpeg, { filename: 'test.jpg', contentType: 'image/jpeg' });
form.append('type', 'employee-attendance');

const options = {
  method: 'POST',
  host: 'localhost',
  port: 3000,
  path: '/api/mobile/upload',
  headers: {
    ...form.getHeaders(),
    'Authorization': 'Bearer test-token'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Response status:', res.statusCode);
    console.log('Response body:', data);
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

form.pipe(req);
