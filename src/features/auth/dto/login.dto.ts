import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Email address of the account.',
    example: 'student@edulab.dev',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Account password.',
    example: 'Str0ngPassword!',
  })
  @IsString()
  @MinLength(1)
  password: string;
}
