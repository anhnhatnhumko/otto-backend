const { MongoClient, ObjectId } = require('mongodb');

async function main() {
  const uri = process.argv[2] || 'mongodb://localhost:27017/otto';
  const taskerId = process.argv[3] || '69fa314196785cb4692015c6';
  const c = await MongoClient.connect(uri);
  const db = c.db();

  const tasker = await db.collection('users').findOne({ _id: new ObjectId(taskerId) }, { projection: { fullName: 1, wardId: 1, skills: 1, isOnline: 1, isAvailable: 1 } });
  if (!tasker) throw new Error('Tasker not found');

  const wardId = tasker.wardId;
  const skillIds = (tasker.skills || []).map((s) => new ObjectId(String(s)));

  const wardOrders = await db.collection('orders').find({
    status: 'SEARCHING',
    wardId: new ObjectId(String(wardId)),
  }).project({
    _id: 1,
    status: 1,
    wardId: 1,
    serviceId: 1,
    offeredTaskers: 1,
    rejectedTaskers: 1,
    paymentMethod: 1,
    serviceSnapshot: 1,
    scheduleTime: 1,
    startTime: 1,
    endTime: 1,
    createdAt: 1,
  }).sort({ createdAt: -1 }).toArray();

  const matchedBySkill = wardOrders.filter((order) => skillIds.some((sid) => String(sid) === String(order.serviceId)));
  const offeredToTasker = wardOrders.filter((order) => Array.isArray(order.offeredTaskers) && order.offeredTaskers.some((id) => String(id) === String(taskerId)));

  console.log(JSON.stringify({
    tasker: {
      _id: taskerId,
      fullName: tasker.fullName,
      wardId: String(wardId),
      skills: tasker.skills,
      isOnline: tasker.isOnline,
      isAvailable: tasker.isAvailable,
    },
    wardSearchingOrdersCount: wardOrders.length,
    matchedBySkillCount: matchedBySkill.length,
    offeredToTaskerCount: offeredToTasker.length,
    wardOrders,
    matchedBySkill,
    offeredToTasker,
  }, null, 2));

  await c.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
