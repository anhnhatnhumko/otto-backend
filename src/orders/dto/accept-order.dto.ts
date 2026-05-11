import { IsMongoId } from 'class-validator';

export class AcceptOrderDto {
  @IsMongoId()
  taskerId: string;
}
