import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'jane_doe or jane@example.com' })
  @IsString()
  usernameOrEmail: string;

  @ApiProperty()
  @IsString()
  password: string;
}
