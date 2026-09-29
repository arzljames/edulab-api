import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Mirrors the DB's `resource_visibility` enum
 * (`supabase/database.types.ts`). Kept here, alongside the DTO that first
 * needs it, and re-exported for reuse by `UpdateResourceDto` /
 * `ResourceResponseDto`.
 */
export enum ResourceVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
}

export class CreateResourceDto {
  @ApiProperty({
    description: 'Title of the resource.',
    example: 'Grade 5 Fractions Worksheet',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({
    description: 'Longer description of the resource.',
    example: 'A printable worksheet covering fraction addition.',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Grade level the resource targets.',
    example: 'Grade 5',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  gradeLevel?: string;

  @ApiPropertyOptional({
    description: 'Subject area the resource belongs to.',
    example: 'Mathematics',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  subject?: string;

  @ApiPropertyOptional({
    description: 'URL or storage path of the uploaded file.',
    example: 'https://storage.edulab.dev/resources/fractions.pdf',
    maxLength: 2048,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  file?: string;

  @ApiPropertyOptional({
    description:
      'Visibility of the resource. Defaults to the database default if omitted.',
    enum: ResourceVisibility,
    example: ResourceVisibility.PUBLIC,
  })
  @IsOptional()
  @IsEnum(ResourceVisibility)
  visibility?: ResourceVisibility;

  @ApiPropertyOptional({
    description:
      'Tag names to associate with the resource. Tags are upserted by name.',
    type: [String],
    example: ['fractions', 'worksheet'],
    maxItems: 20,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Type(() => String)
  tags?: string[];
}
