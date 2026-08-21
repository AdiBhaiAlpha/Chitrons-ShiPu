const axios = require('axios');
async function test() {
  try {
    const res = await axios.get('http://localhost:3000/api/supabase/status', {
      headers: {
        'Cookie': 'admin_token=bypass_in_test' // actually we need proper auth, let's bypass auth for testing or use admin_token
      }
    });
    console.log(res.data);
  } catch (err) {
    console.log(err.message);
  }
}
test();
