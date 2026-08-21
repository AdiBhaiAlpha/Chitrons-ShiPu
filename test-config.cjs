const axios = require('axios');
async function test() {
  try {
    const res = await axios.get('http://localhost:3000/api/supabase/config', {
      headers: {
        'Cookie': 'admin_token=admin'
      }
    });
    console.log("Config from GET:", res.data);
  } catch (err) {
    console.log(err.message);
  }
}
test();
