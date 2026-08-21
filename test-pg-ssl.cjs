const { Client } = require('pg');
async function test() {
  const client = new Client({
    connectionString: 'postgresql://postgres:fake@db.ubfqpeyosyuaxrlqomqp.supabase.co:5432/postgres'
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
