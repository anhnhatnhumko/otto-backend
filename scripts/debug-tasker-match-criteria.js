const { MongoClient, ObjectId } = require('mongodb');

async function main() {
  const uri = process.argv[2] || 'mongodb://localhost:27017/otto';
  const taskerId = process.argv[3] || '69fa314196785cb4692015c6';
  const serviceId = process.argv[4] || '69a152a25516efde62a6965e';
  const wardId = process.argv[5] || '69ab28cafc9f4947244fa38d';

  const c = await MongoClient.connect(uri);
  const users = c.db().collection('users');

  const tasker = await users.findOne({ _id: new ObjectId(taskerId) }, { projection: { _id: 1, fullName: 1, wardId: 1, skills: 1, role: 1 } });
  const serviceObjectId = new ObjectId(serviceId);

  const matches = {
    directTasker: !!(await users.findOne({ _id: new ObjectId(taskerId) })),
    roleAndWard: !!(await users.findOne({ _id: new ObjectId(taskerId), role: 'TASKER', wardId: { $in: [new ObjectId(wardId), wardId] } })),
    skillStringOnly: !!(await users.findOne({ _id: new ObjectId(taskerId), skills: serviceId })),
    skillObjectIdOnly: !!(await users.findOne({ _id: new ObjectId(taskerId), skills: serviceObjectId })),
    skillInMixed: !!(await users.findOne({ _id: new ObjectId(taskerId), skills: { $in: [serviceObjectId, serviceId] } })),
    roleWardSkillInMixed: !!(await users.findOne({ _id: new ObjectId(taskerId), role: 'TASKER', wardId: { $in: [new ObjectId(wardId), wardId] }, skills: { $in: [serviceObjectId, serviceId] } })),
  };

  const raw = await c.db().collection('users').aggregate([
    { $match: { _id: new ObjectId(taskerId) } },
    { $project: { skills: 1, skillsTypes: { $map: { input: '$skills', as: 's', in: { $type: '$$s' } } }, wardType: { $type: '$wardId' }, provinceType: { $type: '$provinceId' } } },
  ]).toArray();

  console.log(JSON.stringify({ tasker, matches, raw }, null, 2));
  await c.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
