import { IsMongoId, IsNumber, Max, Min, IsOptional } from 'class-validator';

export class CreateReviewDto {
  @IsMongoId()
  orderId: string;

  @IsMongoId()
  taskerId: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  comment: string;
}
