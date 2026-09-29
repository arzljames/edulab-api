import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token previously issued by Supabase Auth.',
    example: 'v1.Mr5MSp8N...',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
