import { ApiProperty } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty({
    description: 'Unique identifier of the authenticated user.',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  id: string;

  @ApiProperty({
    description: 'Email address of the authenticated user.',
    example: 'student@edulab.dev',
  })
  email: string;
}

export class AuthResponseDto {
  @ApiProperty({
    description: 'Short-lived JWT used to authenticate subsequent requests.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Long-lived token used to obtain a new access token.',
    example: 'v1.Mr5MSp8N...',
  })
  refreshToken: string;

  @ApiProperty({
    description: 'Unix timestamp (seconds) at which the access token expires.',
    example: 1732384421,
  })
  expiresAt: number;

  @ApiProperty({
    description: 'The authenticated user.',
    type: AuthUserDto,
  })
  user: AuthUserDto;
}
