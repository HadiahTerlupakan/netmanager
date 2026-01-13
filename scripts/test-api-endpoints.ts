
import axios from 'axios';

const API_URL = 'http://localhost:3000'; // Running locally on the server

async function testApi() {
  try {
    console.log('1. Attempting Login...');
    const loginRes = await axios.post(`${API_URL}/api/mobile/auth/login`, {
      email: 'rohadimraja@gmail.com', // Using user from previous logs
      password: 'password' // I don't know the password, this might fail.
                           // Actually, let's try to just hit the endpoint without login first
                           // or use a mock token if we can sign one.
    });
    
    // If login fails (password unknown), I can't easily test with full auth flow unless I know a valid cred.
    // However, I can check if the server is reachable.
    console.log('Login Response:', loginRes.status);
    const token = loginRes.data.data.token;
    console.log('Token received:', token ? 'YES' : 'NO');

    if(token) {
        console.log('2. Testing Dashboard Stats...');
        try {
            const dashboardRes = await axios.get(`${API_URL}/api/mobile/dashboard`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('Dashboard Status:', dashboardRes.status);
            console.log('Dashboard Data:', JSON.stringify(dashboardRes.data, null, 2));
        } catch (e: any) {
            console.error('Dashboard Failed:', e.message, e.response?.data);
        }

        console.log('3. Testing Canvasing Summary...');
        try {
            const canvasRes = await axios.get(`${API_URL}/api/marketing/canvasing/summary`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('Canvasing Status:', canvasRes.status);
            console.log('Canvasing Data:', JSON.stringify(canvasRes.data, null, 2));
        } catch (e: any) {
            console.error('Canvasing Failed:', e.message, e.response?.data);
        }
    }

  } catch (error: any) {
    console.error('Login Failed/Error:', error.message);
    if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
    }
  }
}

testApi();
