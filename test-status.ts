import axios from 'axios';
async function run() {
  try {
    const res = await axios.get('http://localhost:3000/');
    console.log('HTTP 200 OK');
  } catch(e:any) {
    console.error(e.message);
  }
}
run();
