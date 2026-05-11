import {
  IsDate,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
  IsNumber,
  IsString,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO cho object location
 */
class LocationDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;
}

class ServiceSnapshotDto {
  @IsString()
  name: string;

  @IsNumber()
  price: number;
}

export class CreateOrderDto {

  @IsMongoId()
  serviceId: string;

  @Type(() => Date)
  @IsDate()
  scheduleTime: Date;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsMongoId()
  provinceId: string;

  @IsMongoId()
  wardId: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  addressDetail?: string;

  @IsOptional()
  note: string;

  @IsOptional()
  @IsIn(['cash', 'wallet', 'stripe'])
  paymentMethod?: string;

  @ValidateNested()
  @Type(() => ServiceSnapshotDto)
  serviceSnapshot: ServiceSnapshotDto;
}