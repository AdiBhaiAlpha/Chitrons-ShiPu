const axios = require('axios');
async function test() {
  try {
    const res = await axios.post('https://ubfqpeyosyuaxrlqomqp.supabase.co/pg-meta/default/query', { query: 'SELECT 1;' }, {
      headers: {
        // I don't have the real key, I'll just check if it returns 401 instead of 404
        'apikey': 'fake',
        'Authorization': 'Bearer fake'
      }
    });
    console.log(res.status);
  } catch(e) {
    console.log(e.response ? e.response.status : e.message);
  }
}
test();
