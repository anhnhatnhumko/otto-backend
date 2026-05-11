const { MongoClient } = require('mongodb');
(async () => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/otto';
  const client = await MongoClient.connect(uri);
  try {
    const db = client.db();
    const order = await db.collection('orders').findOne({ status: { $in: ['ASSIGNED','IN_PROGRESS'] } });
    if (!order) {
      console.log(JSON.stringify({ notFound: true }));
    } else {
      console.log(JSON.stringify({ _id: order._id.toString(), status: order.status, taskerId: order.taskerId }));
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await client.close();
  }
})();
