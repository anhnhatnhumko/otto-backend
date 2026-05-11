/*
  Script: list-timeout-assigned.js
  Purpose: Connect to MongoDB and list orders that are in TIMEOUT state and have a tasker assigned (i.e., likely transitioned from ASSIGNED -> TIMEOUT).
  Usage: node scripts/list-timeout-assigned.js mongodb://localhost:27017/otto [--days=7]
*/

const { MongoClient } = require('mongodb');

async function main() {
  const uri = process.argv[2] || 'mongodb://localhost:27017/otto';
  const daysArg = process.argv.find(a => a.startsWith('--days='));
  const days = daysArg ? parseInt(daysArg.split('=')[1], 10) : 30; // default 30 days

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();
    const orders = db.collection('orders');

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const cursor = orders.find({
      status: 'TIMEOUT',
      taskerId: { $ne: null },
      updatedAt: { $gte: since },
    }).sort({ updatedAt: -1 }).limit(200);

    const results = await cursor.toArray();

    if (!results.length) {
      console.log('No timeout orders with assigned tasker found in the last', days, 'days');
      return;
    }

    console.log(`Found ${results.length} TIMEOUT orders with assigned tasker (last ${days} days):`);
    for (const o of results) {
      console.log('---');
      console.log('id:', o._id.toString());
      console.log('customerId:', o.customerId?.toString());
      console.log('taskerId:', o.taskerId?.toString());
      console.log('status:', o.status);
      console.log('scheduleTime:', o.scheduleTime);
      console.log('startTime:', o.startTime);
      console.log('endTime:', o.endTime);
      console.log('paidAt:', o.paidAt);
      console.log('isRefunded:', o.isRefunded);
      console.log('updatedAt:', o.updatedAt);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.close();
  }
}

main();
