// import { Injectable } from '@nestjs/common';
// import { matchingQueue } from './matching.queue';

// @Injectable()
// export class MatchingService {

//   async enqueue(orderId: string, delay = 0) {

//     await matchingQueue.add(
//       'match-order',
//       { orderId },
//       {
//         jobId: orderId,
//         delay,
//         attempts: 3,
//         backoff: {
//           type: 'fixed',
//           delay: 5000,
//         },
//       },
//     );
//   }

// }