const axios = require('axios');
async function test() {
  try {
    const res = await axios.post('http://localhost:3000/api/supabase/config', {
      projectUrl: 'https://ubfqpeyosyuaxrlqomqp.supabase.co',
      anonKey: 'fakeAnon',
      serviceRoleKey: 'fakeService',
      dbConnectionString: 'postgresql://postgres:chitron%402448766@db.ubfqpeyosyuaxrlqomqp.supabase.co:5432/postgres',
      networkMode: 'ipv6'
    }, {
      headers: {
        'Cookie': 'admin_token=admin'
      }
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    if (err.response) {
       console.log(err.response.status, err.response.data);
    } else {
       console.log(err.message);
    }
  }
}
test();
