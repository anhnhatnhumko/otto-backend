const { MongoClient } = require('mongodb');
(async () => {
  try {
    const uri = process.argv[2] || 'mongodb://localhost:27017/otto';
    const c = await MongoClient.connect(uri);
    const docs = await c.db().collection('users').find({ role: 'TASKER', skills: { $exists: true, $ne: [] } }).project({ _id: 1, fullName: 1, phone: 1, skills: 1, provinceId: 1, wardId: 1 }).limit(50).toArray();
    console.log(JSON.stringify(docs, null, 2));
    await c.close();
    process.exit(0);
  } catch (e) {
    console.error('ERROR', e);
    process.exit(1);
  }
})();
