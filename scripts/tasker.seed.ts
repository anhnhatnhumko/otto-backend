import mongoose from "mongoose";
import { LocationSchema } from "../src/locations/location.schema";
import { ProvinceSchema } from "../src/locations/province.schema";
import { UserSchema } from "../src/users/user.schema"; // 🔥 cần có

const MONGO_URI = "mongodb://127.0.0.1:27017/otto";

async function seed() {
  await mongoose.connect(MONGO_URI);

  const Location = mongoose.model("Location", LocationSchema);
  const User = mongoose.model("User", UserSchema);

  console.log("CONNECTED MONGO");

  const ObjectId = mongoose.Types.ObjectId;

  const services = [
    new ObjectId("695e12a58dcb8349894fc581"),
    new ObjectId("69a0988b46ad7eaed7f7618b"),
    new ObjectId("69a151345516efde62a69652"),
    new ObjectId("69a151825516efde62a69655"),
    new ObjectId("69a151a55516efde62a69658"),
    new ObjectId("69a152275516efde62a6965b"),
  ];

  // ✅ đúng Mongoose
  const wards = await Location.find({
    type: { $in: ["WARD", "COMMUNE"] },
  }).lean();

  let users: any[] = [];
  let counter = 0;

  for (let wIndex = 0; wIndex < wards.length; wIndex++) {
    const ward = wards[wIndex];

    for (let sIndex = 0; sIndex < services.length; sIndex++) {
      const service = services[sIndex];

      const numTaskers = Math.floor(Math.random() * 3) + 3;

      for (let i = 0; i < numTaskers; i++) {
        users.push({
          email: `tasker_${wIndex}_${sIndex}_${i}@test.com`,
          phone: `09${Math.floor(10000000 + Math.random() * 89999999)}`,
          password:
            "$2b$10$jOI2r3/xGdZfA6NtYQ0vWO2AW.zIiO3rxHraAsyxh44im7yc/h1nW",
          role: "TASKER",
          fullName: `Tasker ${wIndex}-${sIndex}-${i}`,
          status: "ACTIVE",
          isEmailVerified: true,
          isOnline: true,
          isAvailable: true,
          skills: [service],
          rating: Math.floor(Math.random() * 2) + 4,
          totalJobs: Math.floor(Math.random() * 50),
          provinceId: ward.provinceId,
          wardId: ward._id,
          currentLocation: {
            lat: 10 + Math.random(),
            lng: 106 + Math.random(),
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        counter++;
      }
    }
  }

  // ✅ đúng Mongoose
  await User.insertMany(users);

  console.log("Inserted users:", counter);

  await mongoose.disconnect();
}

seed();