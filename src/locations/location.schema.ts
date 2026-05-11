import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type LocationDocument = Location & Document;

export enum LocationType {
  WARD = 'WARD',
  COMMUNE = 'COMMUNE',
  SPECIAL = 'SPECIAL'
}

@Schema({ timestamps: true })
export class Location {

  @Prop({ required: true })
  name: string;

  @Prop({
    enum: LocationType,
    required: true,
    index: true
  })
  type: LocationType;

  @Prop({
    type: Types.ObjectId,
    ref: 'Province',
    required: true,
    index: true
  })
  provinceId: Types.ObjectId;

}

export const LocationSchema = SchemaFactory.createForClass(Location);