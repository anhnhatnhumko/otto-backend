import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TaskerRequestDocument = TaskerRequest & Document;

@Schema({ timestamps: true })
export class TaskerRequest {
  @Prop({
    type: {
      fullName: String,
      email: String,
      phone: String,
      idCard: String,
      address: String,
      district: String,
      city: String,
      experience: String,
      introduction: String,
    },
    required: true,
  })
  formData: {
    fullName?: string;
    email?: string;
    phone?: string;
    idCard?: string;
    address?: string;
    district?: string;
    city?: string;
    experience?: string;
    introduction?: string;
  };

  @Prop({ type: [String], default: [] })
  services: string[];

  @Prop({ type: String, default: 'pending' })
  status: string;

  @Prop({ type: String, default: null })
  adminNote?: string | null;
}

export const TaskerRequestSchema = SchemaFactory.createForClass(TaskerRequest);
