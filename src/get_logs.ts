import { connectMongoDB, AILogModel } from './db/mongodb';

async function run() {
  await connectMongoDB();
  const logs = await AILogModel.find().sort({ timestamp: -1 }).limit(10);
  console.log('--- LAST 10 AI LOGS ---');
  for (const log of logs) {
    console.log(`Time: ${log.timestamp}`);
    console.log(`Success: ${log.success}`);
    console.log(`Model: ${log.model}`);
    console.log(`Error: ${log.errorMessage}`);
    console.log(`Prompt: ${log.prompt}`);
    console.log('-------------------------');
  }
  process.exit(0);
}

run().catch(console.error);
