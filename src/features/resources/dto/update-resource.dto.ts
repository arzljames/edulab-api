import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateResourceDto } from './create-resource.dto';

/**
 * Mirrors the DB's `resource_status` enum
 * (`supabase/database.types.ts`). Publishing a resource happens through a
 * `PATCH` that sets `status`, so it lives on the update DTO rather than the
 * create DTO.
 */
export enum ResourceStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

export class UpdateResourceDto extends PartialType(CreateResourceDto) {
  @ApiPropertyOptional({
    description: 'Publication status of the resource.',
    enum: ResourceStatus,
    example: ResourceStatus.PUBLISHED,
  })
  @IsOptional()
  @IsEnum(ResourceStatus)
  status?: ResourceStatus;
}
