import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../../auth/auth.service';
import { LoginDto } from '../../auth/dto/login.dto';

@ApiTags('admin/auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({
    summary:
      'Log in to the admin panel; rejects accounts that are not admin/moderator',
  })
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: result.user.id },
    });
    if (user.role !== Role.admin && user.role !== Role.moderator) {
      await this.authService.logout(result.refreshToken);
      throw new ForbiddenException('This account does not have admin access');
    }

    return { ...result, user: { ...result.user, role: user.role } };
  }
}
