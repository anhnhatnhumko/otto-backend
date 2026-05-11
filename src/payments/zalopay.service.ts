// import { Injectable } from '@nestjs/common';
// import * as crypto from 'crypto';
// import axios from 'axios';

// @Injectable()
// export class ZaloPayService {
//   private config = {
//     app_id: process.env.ZP_APP_ID,
//     key1: process.env.ZP_KEY1,
//     key2: process.env.ZP_KEY2,
//     endpoint: 'https://sb-openapi.zalopay.vn/v2/create',
//   };

//   createOrder(order: any) {
//     const data =
//       this.config.app_id +
//       '|' +
//       order.app_trans_id +
//       '|' +
//       order.app_user +
//       '|' +
//       order.amount +
//       '|' +
//       order.app_time +
//       '|' +
//       order.embed_data +
//       '|' +
//       order.item;

//     const mac = crypto
//       .createHmac('sha256', this.config.key1)
//       .update(data)
//       .digest('hex');

//     return axios.post(this.config.endpoint, {
//       ...order,
//       mac,
//     });
//   }

//   verifyCallback(data: string, mac: string) {
//     const macCheck = crypto
//       .createHmac('sha256', this.config.key2)
//       .update(data)
//       .digest('hex');

//     return mac === macCheck;
//   }
// }