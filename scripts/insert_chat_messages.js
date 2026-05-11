const { MongoClient } = require('mongodb');
(async () => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/otto';
  const client = await MongoClient.connect(uri);
  try {
    const db = client.db();
    const orderId = process.argv[2] || '69f33bb5d1a1b570c1ab0f76';
    const msgs = [
      { orderId, senderId: 'script-customer', senderRole: 'CUSTOMER', text: 'Xin chào, tôi cần cập nhật.', createdAt: new Date() },
      { orderId, senderId: 'script-tasker', senderRole: 'TASKER', text: 'Đã nhận, tôi sẽ tới trong 10 phút.', createdAt: new Date() },
    ];
    const res = await db.collection('chatmessages').insertMany(msgs);
    console.log('Inserted', res.insertedCount, 'messages');
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await client.close();
  }
})();
