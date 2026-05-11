import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ServiceDocument = Service & Document;

@Schema({ timestamps: true })
export class Service {

  @Prop({ required: true, index: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  pricePerHour: number;

  @Prop({ default: 2 })
  minHours: number;

  @Prop({ default: 12 })
  maxHours: number;

  @Prop()
  estimatedTime: number;

  @Prop({ default: true, index: true })
  isActive: boolean;
}

export const ServiceSchema = SchemaFactory.createForClass(Service);
