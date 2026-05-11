const { MongoClient, ObjectId } = require('mongodb');

async function main() {
  const uri = process.argv[2] || 'mongodb://localhost:27017/otto';
  const orderId = process.argv[3] || '69fa9d5bfc3ecf144636116b';
  const taskerId = process.argv[4] || '69fa314196785cb4692015c6';

  const c = await MongoClient.connect(uri);
  const db = c.db();

  const order = await db.collection('orders').findOne(
    { _id: new ObjectId(orderId) },
    {
      projection: {
        _id: 1,
        status: 1,
        customerId: 1,
        taskerId: 1,
        serviceId: 1,
        provinceId: 1,
        wardId: 1,
        offeredTaskers: 1,
        rejectedTaskers: 1,
        paymentMethod: 1,
        scheduleTime: 1,
        startTime: 1,
        endTime: 1,
        totalPrice: 1,
        serviceSnapshot: 1,
        createdAt: 1,
      },
    },
  );

  const tasker = await db.collection('users').findOne(
    { _id: new ObjectId(taskerId) },
    { projection: { _id: 1, fullName: 1, role: 1, wardId: 1, provinceId: 1, skills: 1, isOnline: 1, isAvailable: 1 } },
  );

  if (!order) throw new Error('Order not found');
  if (!tasker) throw new Error('Tasker not found');

  const skillIds = (tasker.skills || []).map((s) => String(s));
  const isWardMatch = String(order.wardId) === String(tasker.wardId);
  const isProvinceMatch = String(order.provinceId) === String(tasker.provinceId);
  const isSkillMatch = skillIds.some((sid) => String(order.serviceId) === sid);
  const isOffered = Array.isArray(order.offeredTaskers) && order.offeredTaskers.some((id) => String(id) === String(tasker._id));
  const isRejected = Array.isArray(order.rejectedTaskers) && order.rejectedTaskers.some((id) => String(id) === String(tasker._id));

  const busyTaskers = await db.collection('orders').distinct('taskerId', {
    status: { $in: ['ASSIGNED', 'IN_PROGRESS'] },
    startTime: { $lt: order.endTime },
    endTime: { $gt: order.startTime },
  });

  const availableTaskers = await db.collection('users').find({
    role: 'TASKER',
    wardId: new ObjectId(String(order.wardId)),
    skills: { $in: [new ObjectId(String(order.serviceId)), String(order.serviceId)] },
    _id: { $nin: busyTaskers.filter(Boolean).concat(order.rejectedTaskers || []) },
  }).project({ _id: 1, fullName: 1, skills: 1, wardId: 1, provinceId: 1, isOnline: 1, isAvailable: 1 }).sort({ rating: -1 }).limit(20).toArray();

  console.log(JSON.stringify({
    order,
    tasker,
    checks: {
      isWardMatch,
      isProvinceMatch,
      isSkillMatch,
      isOffered,
      isRejected,
    },
    busyTaskers: busyTaskers.map(String),
    availableTaskersCount: availableTaskers.length,
    availableTaskersSample: availableTaskers.slice(0, 10),
  }, null, 2));

  await c.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
