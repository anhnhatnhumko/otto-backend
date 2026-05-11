const { MongoClient, ObjectId } = require('mongodb');

const DEFAULT_URI = 'mongodb://127.0.0.1:27017/otto';

function normalizePart(value) {
  return String(value ?? '').trim();
}

function buildFullAddress(addressDetail, wardName, provinceName) {
  const parts = [];

  const seedParts = String(addressDetail ?? '')
    .split(',')
    .map(normalizePart)
    .filter(Boolean);

  for (const part of seedParts) {
    if (!parts.includes(part)) {
      parts.push(part);
    }
  }

  const ward = normalizePart(wardName);
  const province = normalizePart(provinceName);

  if (ward && !parts.includes(ward)) {
    parts.push(ward);
  }

  if (province && !parts.includes(province)) {
    parts.push(province);
  }

  return parts.join(', ');
}

function toObjectId(value) {
  const text = normalizePart(value);
  if (!text || !ObjectId.isValid(text)) return null;
  return new ObjectId(text);
}

(async () => {
  const uri = process.argv[2] || DEFAULT_URI;
  const dryRun = process.argv.includes('--dry');

  const client = await MongoClient.connect(uri);
  try {
    const db = client.db();
    const orders = db.collection('orders');
    const provinces = db.collection('provinces');
    const locations = db.collection('locations');

    const provinceCache = new Map();
    const wardCache = new Map();

    async function getProvinceName(provinceId) {
      const key = normalizePart(provinceId);
      if (!key) return '';
      if (provinceCache.has(key)) return provinceCache.get(key);

      const query = toObjectId(key) || key;
      const doc = await provinces.findOne({ _id: query }, { projection: { name: 1 } });
      const name = normalizePart(doc?.name);
      provinceCache.set(key, name);
      return name;
    }

    async function getWardName(wardId) {
      const key = normalizePart(wardId);
      if (!key) return '';
      if (wardCache.has(key)) return wardCache.get(key);

      const query = toObjectId(key) || key;
      const doc = await locations.findOne({ _id: query }, { projection: { name: 1 } });
      const name = normalizePart(doc?.name);
      wardCache.set(key, name);
      return name;
    }

    const cursor = orders.find(
      {},
      {
        projection: {
          address: 1,
          addressDetail: 1,
          provinceId: 1,
          wardId: 1,
        },
      },
    );

    let processed = 0;
    let updated = 0;

    while (await cursor.hasNext()) {
      const order = await cursor.next();
      processed += 1;

      const provinceName = await getProvinceName(order?.provinceId);
      const wardName = await getWardName(order?.wardId);
      const addressDetail = normalizePart(order?.addressDetail || order?.address);
      const fullAddress = buildFullAddress(addressDetail, wardName, provinceName);

      if (!fullAddress) {
        continue;
      }

      const nextAddress = fullAddress;
      const nextAddressDetail = fullAddress;

      if (normalizePart(order?.address) === nextAddress && normalizePart(order?.addressDetail) === nextAddressDetail) {
        continue;
      }

      console.log(
        `[${dryRun ? 'DRY' : 'FIX'}] ${String(order._id)} => ${nextAddress}`,
      );

      if (!dryRun) {
        await orders.updateOne(
          { _id: order._id },
          {
            $set: {
              address: nextAddress,
              addressDetail: nextAddressDetail,
            },
          },
        );
      }

      updated += 1;
    }

    console.log(`Processed ${processed} orders, updated ${updated} orders.`);
  } finally {
    await client.close();
  }
})().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
