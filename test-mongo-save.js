const { connectMongoDB, BotSettingModel } = require('./src/db/mongodb');

async function test() {
  await connectMongoDB();
  const doc = await BotSettingModel.findOne({ key: 'SUPABASE_CONFIG' });
  console.log('Saved config:', doc?.value);
  process.exit(0);
}
test();
