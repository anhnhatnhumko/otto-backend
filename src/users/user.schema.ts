import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { isEmail } from 'class-validator';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true, unique: true })
  phone: string;

  @Prop({ required: true })
  password: string;

  @Prop({ enum: ['CUSTOMER', 'TASKER', 'ADMIN'], required: true })
  role: string;

  @Prop()
  fullName: string;

  @Prop()
  avatar: string;

  @Prop({ enum: ['ACTIVE', 'BLOCKED'], default: 'ACTIVE' })
  status: string;

  @Prop({ default: false })
  isEmailVerified: boolean;

  @Prop({ default: false })
  mustChangePassword: boolean;

  @Prop()
  emailVerifyToken?: string;

  @Prop()
  resetPasswordToken?: string;

  @Prop()
  resetPasswordExpires?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Province' })
  provinceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Ward' })
  wardId: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: 'Ward', default: [] })
  wardIds: Types.ObjectId[];

  @Prop()
  emailVerifyExpires?: Date;

  @Prop({ default: false })
  isOnline: boolean;

  @Prop({ default: true })
  isAvailable: boolean;

  @Prop({ type: [Types.ObjectId], ref: 'Service', default: [] })
  skills: Types.ObjectId[];

  @Prop({ default: 0 })
  rating: number;

  @Prop({ default: 0 })
  totalJobs: number;

  @Prop({
    type: {
      lat: Number,
      lng: Number,
    },
    _id: false,
  })
  currentLocation: {
    lat: number;
    lng: number;
  };

  @Prop()
  address?: string;

  @Prop()
  idCard?: string;

  @Prop({ default: 0 })
  earnings?: number;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ role: 1 });
UserSchema.index({ provinceId: 1 });
UserSchema.index({ wardId: 1 });
UserSchema.index({ role: 1, provinceId: 1, wardId: 1 });
