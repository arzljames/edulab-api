import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CommentResponseDto {
  @ApiProperty({
    description: 'Comment id.',
    example: '5d4c3b2a-1f0e-4d9c-8b7a-6e5d4c3b2a1f',
  })
  id: string;

  @ApiProperty({
    description: 'Id of the resource this comment belongs to.',
    example: '3f2a1c4e-9b7d-4e2a-8c1f-1a2b3c4d5e6f',
  })
  resourceId: string;

  @ApiPropertyOptional({
    description: 'Id of the user who wrote the comment, if still known.',
    example: 'a1b2c3d4-e5f6-4789-90ab-cdef01234567',
    nullable: true,
  })
  userId: string | null;

  @ApiPropertyOptional({
    description: 'Id of the parent comment, for threaded replies.',
    example: '3f2a1c4e-9b7d-4e2a-8c1f-1a2b3c4d5e6f',
    nullable: true,
  })
  parentCommentId: string | null;

  @ApiProperty({
    description: 'Comment body.',
    example: 'This worksheet was really helpful, thank you!',
  })
  comment: string;

  @ApiProperty({
    description: 'Creation timestamp.',
    example: '2026-01-10T08:30:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Last update timestamp.',
    example: '2026-01-10T08:30:00.000Z',
  })
  updatedAt: string;
}
