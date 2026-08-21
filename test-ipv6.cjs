const dns = require('dns').promises;
const net = require('net');

async function test() {
  const host = 'db.ubfqpeyosyuaxrlqomqp.supabase.co';
  try {
    const records = await dns.resolve6(host);
    console.log('IPv6 records:', records);
    if (records.length > 0) {
      const socket = net.createConnection({ host: records[0], port: 5432, family: 6 }, () => {
        console.log('Successfully connected via IPv6 TCP');
        socket.destroy();
      });
      socket.on('error', (err) => {
        console.log('IPv6 connection error:', err.message);
      });
    }
  } catch (err) {
    console.log('IPv6 resolution error:', err.message);
  }
}
test();
