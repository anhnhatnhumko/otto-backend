const { MongoClient, ObjectId } = require('mongodb');
(async () => {
  try {
    const uri = process.argv[2] || 'mongodb://localhost:27017/otto';
    const dryRun = process.argv.includes('--dry');
    const c = await MongoClient.connect(uri);
    const coll = c.db().collection('users');

    const cursor = coll.find({ role: 'TASKER', skills: { $exists: true, $ne: [] } });
    let count = 0;
    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      const skills = Array.isArray(doc.skills) ? doc.skills : [];
      const needs = skills.some(s => typeof s === 'string');
      if (!needs) continue;

      const newSkills = skills.map(s => {
        try {
          return typeof s === 'string' && ObjectId.isValid(s) ? new ObjectId(s) : s;
        } catch (e) {
          return s;
        }
      });

      console.log('Will update user:', String(doc._id), 'from', skills, 'to', newSkills);

      if (!dryRun) {
        await coll.updateOne({ _id: doc._id }, { $set: { skills: newSkills } });
        console.log('Updated', String(doc._id));
      }
      count++;
    }

    console.log('Processed', count, 'users');
    await c.close();
    process.exit(0);
  } catch (e) {
    console.error('ERROR', e);
    process.exit(1);
  }
})();
