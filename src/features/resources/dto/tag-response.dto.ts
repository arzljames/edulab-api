import { ApiProperty } from '@nestjs/swagger';

export class TagResponseDto {
  @ApiProperty({
    description: 'Tag id.',
    example: '9c8b7a6d-5e4f-4321-9876-0fedcba98765',
  })
  id: string;

  @ApiProperty({
    description: 'Tag name.',
    example: 'fractions',
  })
  name: string;

  @ApiProperty({
    description: 'Creation timestamp.',
    example: '2026-01-10T08:30:00.000Z',
  })
  createdAt: string;
}
