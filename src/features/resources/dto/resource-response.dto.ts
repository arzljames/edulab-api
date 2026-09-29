import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResourceVisibility } from './create-resource.dto';
import { ResourceStatus } from './update-resource.dto';

export class ResourceResponseDto {
  @ApiProperty({
    description: 'Resource id.',
    example: '3f2a1c4e-9b7d-4e2a-8c1f-1a2b3c4d5e6f',
  })
  id: string;

  @ApiProperty({
    description: 'Id of the user who owns the resource.',
    example: 'a1b2c3d4-e5f6-4789-90ab-cdef01234567',
  })
  userId: string;

  @ApiProperty({
    description: 'Title of the resource.',
    example: 'Grade 5 Fractions Worksheet',
  })
  title: string;

  @ApiPropertyOptional({
    description: 'Longer description of the resource.',
    example: 'A printable worksheet covering fraction addition.',
    nullable: true,
  })
  description: string | null;

  @ApiPropertyOptional({
    description: 'Grade level the resource targets.',
    example: 'Grade 5',
    nullable: true,
  })
  gradeLevel: string | null;

  @ApiPropertyOptional({
    description: 'Subject area the resource belongs to.',
    example: 'Mathematics',
    nullable: true,
  })
  subject: string | null;

  @ApiPropertyOptional({
    description: 'URL or storage path of the uploaded file.',
    example: 'https://storage.edulab.dev/resources/fractions.pdf',
    nullable: true,
  })
  file: string | null;

  @ApiProperty({
    description: 'Visibility of the resource.',
    enum: ResourceVisibility,
    example: ResourceVisibility.PUBLIC,
  })
  visibility: ResourceVisibility;

  @ApiProperty({
    description: 'Publication status of the resource.',
    enum: ResourceStatus,
    example: ResourceStatus.PUBLISHED,
  })
  status: ResourceStatus;

  @ApiPropertyOptional({
    description: 'Timestamp the resource was published, if ever.',
    example: '2026-01-15T10:00:00.000Z',
    nullable: true,
  })
  publishedAt: string | null;

  @ApiProperty({
    description: 'Names of tags attached to the resource.',
    type: [String],
    example: ['fractions', 'worksheet'],
  })
  tags: string[];

  @ApiProperty({
    description: 'Creation timestamp.',
    example: '2026-01-10T08:30:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Last update timestamp.',
    example: '2026-01-15T10:00:00.000Z',
  })
  updatedAt: string;
}
