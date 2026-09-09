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
import { DeleteAccountDto } from './dto/delete-account.dto';
import { MuteUserDto } from './dto/mute-user.dto';

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
    // Body still validated (kept as documentation of intent + allowed types), even
    // though the signed-upload flow no longer needs contentType to pick a file extension.
    @Body() _dto: RequestAvatarUploadDto,
  ) {
    return this.usersService.requestAvatarUpload(user.id);
  }

  @Post('me/deactivate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Temporarily deactivate your own account (reactivates automatically on next login)',
  })
  deactivateMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.deactivateMe(user.id);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Permanently delete your own account' })
  deleteMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeleteAccountDto,
  ) {
    return this.usersService.deleteMe(user.id, dto);
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

  @Get('me/restricted')
  @ApiOperation({ summary: 'List users the current user has restricted' })
  listRestricted(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listRestricted(user.id);
  }

  @Post(':userId/restrict')
  @ApiOperation({
    summary:
      'Restrict a user — their comments on your posts become visible only to you and them, silently (no notification to them)',
  })
  restrictUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.usersService.restrictUser(user.id, userId);
  }

  @Delete(':userId/restrict')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unrestrict a user' })
  unrestrictUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.usersService.unrestrictUser(user.id, userId);
  }

  @Get('me/muted')
  @ApiOperation({ summary: 'List users the current user has muted' })
  listMuted(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listMuted(user.id);
  }

  @Post(':userId/mute')
  @ApiOperation({
    summary:
      "Mute a user's posts and/or stories from your feed, without unfollowing them",
  })
  muteUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: MuteUserDto,
  ) {
    return this.usersService.muteUser(user.id, userId, dto);
  }

  @Delete(':userId/mute')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unmute a user' })
  unmuteUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.usersService.unmuteUser(user.id, userId);
  }
}
