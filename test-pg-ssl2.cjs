const { Client } = require('pg');
async function test() {
  const client = new Client({
    connectionString: 'postgresql://postgres:fake@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres'
  });
  try {
    await client.connect();
    console.log("Connected!");
  } catch (err) {
    console.log("Error:", err.message);
  } finally {
    await client.end();
  }
}
test();
