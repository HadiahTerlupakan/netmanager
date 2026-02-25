const axios = require('axios');
axios.get('http://localhost:3000/api/customer/payment-methods')
  .then(res => console.log("DATA:", JSON.stringify(res.data, null, 2)))
  .catch(err => console.error("ERR:", err.response ? err.response.data : err.message));
