import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ActivityLogEntryResponseDto {
  @ApiProperty({
    description: 'Activity log entry id.',
    example: 'a1b2c3d4-e5f6-4789-90ab-cdef01234567',
  })
  id: string;

  @ApiProperty({
    description: 'Short title describing the action that occurred.',
    example: 'Uploaded a resource',
  })
  actionTitle: string;

  @ApiPropertyOptional({
    description: 'Additional detail about the action.',
    example: 'Uploaded "Fractions Worksheet.pdf" to Mathematics.',
    nullable: true,
  })
  description: string | null;

  @ApiPropertyOptional({
    description: 'Icon identifier associated with the action.',
    example: 'upload',
    nullable: true,
  })
  icon: string | null;

  @ApiProperty({
    description: 'Creation timestamp.',
    example: '2026-01-10T08:30:00.000Z',
  })
  createdAt: string;
}
