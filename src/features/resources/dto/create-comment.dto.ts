import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({
    description: 'Comment body.',
    example: 'This worksheet was really helpful, thank you!',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  comment: string;

  @ApiPropertyOptional({
    description: 'Id of the parent comment, for threaded replies.',
    example: '3f2a1c4e-9b7d-4e2a-8c1f-1a2b3c4d5e6f',
  })
  @IsOptional()
  @IsUUID()
  parentCommentId?: string;
}
