const axios = require('axios');

async function check() {
  try {
    const res = await axios.get('http://localhost:5000/api/layouts', {
      headers: {
        'x-username': 'admin',
        'x-company-name': 'db_baru_v2', // The backend uses x-company-name as dbName
        'x-role': 'admin'
      }
    });
    console.log("Success:", res.data);
  } catch (err) {
    console.error("Error:", err.response ? err.response.data : err.message);
  }
}
check();
