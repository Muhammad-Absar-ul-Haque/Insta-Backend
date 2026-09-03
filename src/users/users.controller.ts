import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { RequestAvatarUploadDto } from './dto/request-avatar-upload.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me')
  @ApiOperation({ summary: "Update the current user's profile" })
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateMe(user.id, dto);
  }

  @Post('me/avatar')
  @ApiOperation({
    summary:
      'Get a presigned URL to upload a new avatar; then PATCH /users/me with the returned avatarUrl',
  })
  requestAvatarUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestAvatarUploadDto,
  ) {
    return this.usersService.requestAvatarUpload(user.id, dto);
  }

  @Get('me/blocked')
  @ApiOperation({ summary: 'List users the current user has blocked' })
  listBlocked(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listBlocked(user.id);
  }

  @Post(':userId/block')
  @ApiOperation({ summary: 'Block a user' })
  blockUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.usersService.blockUser(user.id, userId);
  }

  @Delete(':userId/block')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unblock a user' })
  unblockUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.usersService.unblockUser(user.id, userId);
  }

  @Get(':username')
  @ApiOperation({ summary: 'Get a public profile by username' })
  getProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('username') username: string,
  ) {
    return this.usersService.getProfileByUsername(username, user.id);
  }
}
