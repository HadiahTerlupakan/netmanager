async function check() {
  try {
    const res = await fetch('http://localhost:3000/admin/login');
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Contains LoginForm:', text.includes('LoginForm') || text.includes('email') || text.includes('NetManager'));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}
check();
