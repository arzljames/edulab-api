import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ResourceListQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by subject.',
    example: 'Mathematics',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  subject?: string;

  @ApiPropertyOptional({
    description: 'Filter by grade level.',
    example: 'Grade 5',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  gradeLevel?: string;

  @ApiPropertyOptional({
    description: 'Filter by tag name.',
    example: 'fractions',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tag?: string;

  @ApiPropertyOptional({
    description: 'Page number, starting at 1.',
    example: 1,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page.',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
