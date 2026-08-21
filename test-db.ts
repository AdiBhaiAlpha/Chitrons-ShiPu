import mongoose from 'mongoose';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/shipu_ai');
  const db = mongoose.connection;
  const col = db.collection('systemcredentials');
  const docs = await col.find({ key: 'SUPABASE_CONFIG' }).toArray();
  console.log(docs);
  process.exit(0);
}
run();
