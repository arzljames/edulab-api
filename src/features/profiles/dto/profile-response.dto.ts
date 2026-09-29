import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProfileResponseDto {
  @ApiProperty({
    description: 'Profile id (matches the Supabase auth user id).',
    example: 'a1b2c3d4-e5f6-4789-90ab-cdef01234567',
  })
  id: string;

  @ApiPropertyOptional({
    description: 'First name.',
    example: 'Jane',
    nullable: true,
  })
  firstName: string | null;

  @ApiPropertyOptional({
    description: 'Middle name.',
    example: 'Marie',
    nullable: true,
  })
  middleName: string | null;

  @ApiPropertyOptional({
    description: 'Last name.',
    example: 'Doe',
    nullable: true,
  })
  lastName: string | null;

  @ApiPropertyOptional({
    description: 'URL or storage path of the profile photo.',
    example: 'https://storage.edulab.dev/avatars/jane-doe.png',
    nullable: true,
  })
  profilePhoto: string | null;

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
