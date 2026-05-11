import mongoose from 'mongoose';

function getArg(name: string, fallback?: string) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const uriArg = process.argv.slice(2).find((item) => !item.startsWith('--'));
  const uri = uriArg || process.env.MONGO_URI || 'mongodb://localhost:27017/otto';
  const dryRun = hasFlag('dry-run') || !hasFlag('confirm');
  const limitArg = getArg('limit');
  const limit = limitArg ? Math.max(1, parseInt(limitArg, 10)) : 100;
  const onlyOverdue = hasFlag('overdue');

  await mongoose.connect(uri);

  const orders = mongoose.connection.collection('orders');

  const filter: Record<string, any> = {
    status: 'TIMEOUT',
    taskerId: { $ne: null },
  };

  if (onlyOverdue) {
    const now = new Date();
    const overdueCutoff = new Date(now.getTime() - 2 * 60 * 1000);
    filter.endTime = { $lte: overdueCutoff };
  }

  const matched = await orders.find(filter).sort({ updatedAt: -1 }).limit(limit).toArray();

  console.log(`Tìm thấy ${matched.length} đơn TIMEOUT phù hợp để reset về ASSIGNED.`);
  matched.forEach((order: any) => {
    console.log(`- ${order._id} | status=${order.status} | taskerId=${order.taskerId} | endTime=${order.endTime}`);
  });

  if (dryRun) {
    console.log('Đang chạy ở chế độ dry-run. Thêm --confirm để cập nhật thật.');
    await mongoose.disconnect();
    return;
  }

  const ids = matched.map((order: any) => order._id);

  if (!ids.length) {
    console.log('Không có đơn nào để cập nhật.');
    await mongoose.disconnect();
    return;
  }

  const result = await orders.updateMany(
    { _id: { $in: ids } },
    {
      $set: {
        status: 'ASSIGNED',
        updatedAt: new Date(),
      },
    },
  );

  console.log(`Đã cập nhật ${result.modifiedCount ?? (result as any).nModified ?? 0} đơn về ASSIGNED.`);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('Reset timeout script failed:', error);
  process.exit(1);
});
