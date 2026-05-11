const { MongoClient, ObjectId } = require('mongodb');

async function main() {
  const uri = process.argv[2] || 'mongodb://localhost:27017/otto';
  const c = await MongoClient.connect(uri);
  const db = c.db();

  const tasker = await db.collection('users').findOne(
    {
      role: 'TASKER',
      skills: { $exists: true, $size: 2 },
    },
    {
      projection: {
        _id: 1,
        fullName: 1,
        phone: 1,
        wardId: 1,
        provinceId: 1,
        skills: 1,
        isAvailable: 1,
        isOnline: 1,
      },
    },
  );

  if (!tasker) {
    console.log('No TASKER with exactly 2 skills found');
    await c.close();
    return;
  }

  const skillIds = (tasker.skills || []).map((s) => String(s));
  const wardId = String(tasker.wardId || '');

  const orders = await db.collection('orders').find({
    status: 'SEARCHING',
    wardId: new ObjectId(wardId),
    serviceId: { $in: skillIds.map((id) => new ObjectId(id)) },
  }).project({
    _id: 1,
    status: 1,
    wardId: 1,
    serviceId: 1,
    offeredTaskers: 1,
    rejectedTaskers: 1,
    paymentMethod: 1,
    scheduleTime: 1,
    startTime: 1,
    endTime: 1,
    serviceSnapshot: 1,
    taskerId: 1,
  }).sort({ createdAt: -1 }).toArray();

  const visible = orders.filter((order) =>
    Array.isArray(order.offeredTaskers) &&
    order.offeredTaskers.some((id) => String(id) === String(tasker._id)),
  );

  const invisibleMatching = orders.filter((order) =>
    !(Array.isArray(order.offeredTaskers) &&
      order.offeredTaskers.some((id) => String(id) === String(tasker._id))),
  );

  console.log(JSON.stringify({
    tasker,
    matchedOrdersCount: orders.length,
    visibleOrdersCount: visible.length,
    visibleOrders: visible,
    invisibleMatchingOrdersCount: invisibleMatching.length,
    invisibleMatchingOrders: invisibleMatching,
  }, null, 2));

  await c.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
