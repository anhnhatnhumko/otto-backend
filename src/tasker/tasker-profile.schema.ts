// import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
// import { Types, Document } from 'mongoose';

// export type TaskerProfileDocument = TaskerProfile & Document;

// @Schema({ timestamps: { createdAt: true, updatedAt: false } })
// export class TaskerProfile {
//   @Prop({ type: Types.ObjectId, ref: 'User', required: true })
//   userId: Types.ObjectId;

//   @Prop({ type: [Types.ObjectId], ref: 'Service' })
//   skills: Types.ObjectId[];

//   @Prop()
//   serviceArea: string;

//   @Prop({ default: 0 })
//   rating: number;

//   @Prop({ default: 0 })
//   totalJobs: number;

//   @Prop({ default: false })
//   isApproved: boolean;
// }

// export const TaskerProfileSchema =
//   SchemaFactory.createForClass(TaskerProfile);
