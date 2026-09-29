import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class SignUpDto {
  @ApiProperty({
    description: 'Email address for the new account.',
    example: 'student@edulab.dev',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Account password, minimum 8 characters.',
    example: 'Str0ngPassword!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password: string;
}
