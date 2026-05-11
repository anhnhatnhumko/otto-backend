import mongoose from "mongoose";
import { LocationSchema } from "../src/locations/location.schema";
import { ProvinceSchema } from "../src/locations/province.schema";

const MONGO_URI = "mongodb://127.0.0.1:27017/otto";

async function seed() {

    await mongoose.connect(MONGO_URI);

    const Province = mongoose.model("Province", ProvinceSchema);
    const Location = mongoose.model("Location", LocationSchema);

    console.log("CONNECTED MONGO");

    // =========================
    // CREATE PROVINCE
    // =========================

    let province = await Province.findOne({ code: "HCM" });

    if (!province) {

        province = await Province.create({
            name: "Thành phố Hồ Chí Minh",
            code: "HCM"
        });

        console.log("PROVINCE CREATED");

    }

    // =========================
    // WARD LIST (SAMPLE)
    // =========================

    const wards = [

        "Phường Sài Gòn",
        "Phường Tân Định",
        "Phường Bến Thành",
        "Phường Cầu Ông Lãnh",
        "Phường Bàn Cờ",
        "Phường Xuân Hòa",
        "Phường Nhiêu Lộc",
        "Phường Xóm Chiếu",
        "Phường Khánh Hội",
        "Phường Vĩnh Hội",
        "Phường Chợ Quán",
        "Phường An Đông",
        "Phường Chợ Lớn",
        "Phường Bình Tây",
        "Phường Bình Tiên",
        "Phường Bình Phú",
        "Phường Phú Lâm",
        "Phường Tân Thuận",
        "Phường Phú Thuận",
        "Phường Tân Mỹ",
        "Phường Tân Hưng",
        "Phường Chánh Hưng",
        "Phường Phú Định",
        "Phường Bình Đông",
        "Phường Diên Hồng",
        "Phường Vườn Lài",
        "Phường Hòa Hưng",
        "Phường Minh Phụng",
        "Phường Bình Thới",
        "Phường Hòa Bình",
        "Phường Phú Thọ",
        "Phường Đông Hưng Thuận",
        "Phường Trung Mỹ Tây",
        "Phường Tân Thới Hiệp",
        "Phường Thới An",
        "Phường Thới Hòa",
        "Phường An Phú Đông",

        "Phường An Lạc",
        "Phường Bình Tân",
        "Phường Tân Tạo",
        "Phường Bình Trị Đông",
        "Phường Bình Hưng Hòa",

        "Phường Gia Định",
        "Phường Bình Thạnh",
        "Phường Bình Lợi Trung",
        "Phường Thạnh Mỹ Tây",
        "Phường Bình Quới",

        "Phường Hạnh Thông",
        "Phường An Nhơn",
        "Phường Gò Vấp",

        "Phường An Hội Đông",
        "Phường Thông Tây Hội",
        "Phường An Hội Tây",

        "Phường Đức Nhuận",
        "Phường Cầu Kiệu",
        "Phường Phú Nhuận",

        "Phường Tân Sơn Hòa",
        "Phường Tân Sơn Nhất",
        "Phường Tân Hòa",
        "Phường Bảy Hiền",
        "Phường Tân Bình",

        "Phường Tân Sơn",
        "Phường Tây Thạnh",
        "Phường Tân Sơn Nhì",
        "Phường Phú Thọ Hòa",
        "Phường Tân Phú",
        "Phường Phú Thạnh",

        "Phường Hiệp Bình",
        "Phường Thủ Đức",
        "Phường Tam Bình",
        "Phường Linh Xuân",
        "Phường Tăng Nhơn Phú",

        "Phường Long Bình",
        "Phường Long Phước",
        "Phường Long Trường",
        "Phường Cát Lái",
        "Phường Bình Trưng",
        "Phường Phước Long",

        "Phường An Khánh",
        "Phường Đông Hòa",
        "Phường Dĩ An",
        "Phường Tân Đông Hiệp",
        "Phường An Phú",

        "Phường Bình Hòa",
        "Phường Lái Thiêu",
        "Phường Thuận Giao",
        "Phường Thuận An",
        "Phường Phú Lợi",

        "Phường Thủ Dầu Một",
        "Phường Chánh Hiệp",
        "Phường Bình Dương",
        "Phường Hòa Lợi",
        "Phường Phú An",
        "Phường Tây Nam",
        "Phường Long Nguyên",
        "Phường Bến Cát",
        "Phường Chánh Phú Hòa",
        "Phường Vĩnh Tân",
        "Phường Bình Cơ",
        "Phường Tân Uyên",
        "Phường Tân Hiệp",
        "Phường Tân Khánh",
        "Phường Vũng Tàu",
        "Phường Tam Thắng",
        "Phường Rạch Dừa",
        "Phường Phước Thắng",
        "Phường Long Hương",
        "Phường Bà Rịa",
        "Phường Tam Long",
        "Phường Tân Hải",
        "Phường Tân Phước",
        "Phường Phú Mỹ",
        "Phường Tân Thành"
    ];

const communes = [

    "Xã Vĩnh Lộc",
    "Xã Tân Vĩnh Lộc",
    "Xã Bình Lợi",
    "Xã Tân Nhựt",
    "Xã Bình Chánh",
    "Xã Hưng Long",
    "Xã Bình Hưng",

    "Xã Bình Khánh",
    "Xã An Thới Đông",
    "Xã Cần Giờ",

    "Xã Củ Chi",
    "Xã Tân An Hội",
    "Xã Thái Mỹ",
    "Xã An Nhơn Tây",
    "Xã Nhuận Đức",
    "Xã Phú Hòa Đông",
    "Xã Bình Mỹ",

    "Xã Đông Thạnh",
    "Xã Hóc Môn",
    "Xã Xuân Thới Sơn",
    "Xã Bà Điểm",

    "Xã Nhà Bè",
    "Xã Hiệp Phước",

    "Xã Thạnh An",
    "Xã Thường Tân",
    "Xã Bắc Tân Uyên",
    "Xã Phú Giáo",
    "Xã Phước Hòa",
    "Xã Phước Thành",
    "Xã An Long",
    "Xã Trừ Văn Thố",
    "Xã Bàu Bàng",
    "Xã Long Hòa",
    "Xã Thanh An",
    "Xã Dầu Tiếng",
    "Xã Minh Thạnh",
    "Xã Châu Pha",
    "Xã Long Hải",
    "Xã Long Điền",
    "Xã Phước Hải",
    "Xã Đất Đỏ",
    "Xã Nghĩa Thành",
    "Xã Ngãi Giao",
    "Xã Kim Long",
    "Xã Châu Đức",
    "Xã Bình Giã",
    "Xã Xuân Sơn",
    "Xã Hồ Tràm",
    "Xã Xuyên Mộc",
    "Xã Hòa Hội",
    "Xã Bàu Lâm",
    "Đặc khu Côn Đảo",
    "Xã Bình Châu",
    "Xã Hòa Hiệp",
    "Xã Long Sơn"

];

    // =========================
    // INSERT WARDS
    // =========================

    for (const name of wards) {

        const exists = await Location.findOne({ name });

        if (!exists) {

            await Location.create({
                name,
                type: "WARD",
                provinceId: province._id
            });

        }

    }

    // =========================
    // INSERT COMMUNES
    // =========================

    for (const name of communes) {

        const exists = await Location.findOne({ name });

        if (!exists) {

            await Location.create({
                name,
                type: "COMMUNE",
                provinceId: province._id
            });

        }

    }

    console.log("SEED DONE");

    process.exit();
}

seed();