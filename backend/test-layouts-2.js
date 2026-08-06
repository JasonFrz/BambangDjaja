const axios = require('axios');

async function check() {
  try {
    const res = await axios.get('http://localhost:5000/api/layouts', {
      headers: {
        'x-username': 'admin, admin', // Simulating what might happen if appended twice
        'x-company-name': 'db_baru_v2',
        'x-db-name': 'db_baru_v2',
        'x-role': 'admin'
      }
    });
    console.log("Success:", res.data);
  } catch (err) {
    console.error("Error:", err.response ? err.response.data : err.message);
  }
}
check();
