import { messengerAccountsData } from './src/db/database';
import { connectMongoDB } from './src/db/mongodb';

async function list() {
    await connectMongoDB();
    const accounts = await messengerAccountsData.getAll();
    console.log(JSON.stringify(accounts, null, 2));
    process.exit(0);
}
list();
