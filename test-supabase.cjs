const axios = require('axios');
async function test() {
  try {
    const res = await axios.post('https://ubfqpeyosyuaxrlqomqp.supabase.co/pg-meta/default/query', { query: 'SELECT 1;' }, {
      headers: {
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
