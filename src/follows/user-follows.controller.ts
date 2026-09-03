import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { CursorPaginationDto } from '../common/dto/cursor-pagination.dto';
import { FollowsService } from './follows.service';

@ApiTags('follows')
@ApiBearerAuth()
@Controller('users')
export class UserFollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Get(':userId/followers')
  @ApiOperation({ summary: "List a user's followers" })
  listFollowers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseIntPipe) userId: number,
    @Query() pagination: CursorPaginationDto,
  ) {
    return this.followsService.listFollowers(userId, user.id, pagination);
  }

  @Get(':userId/following')
  @ApiOperation({ summary: 'List who a user is following' })
  listFollowing(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseIntPipe) userId: number,
    @Query() pagination: CursorPaginationDto,
  ) {
    return this.followsService.listFollowing(userId, user.id, pagination);
  }
}
