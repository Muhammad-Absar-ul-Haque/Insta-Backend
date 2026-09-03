import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { CursorPaginationDto } from '../common/dto/cursor-pagination.dto';
import { FeedService } from './feed.service';

@ApiTags('feed')
@ApiBearerAuth()
@Controller()
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get('feed')
  @ApiOperation({
    summary: 'Home feed: posts from people you follow, plus your own',
  })
  getHomeFeed(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: CursorPaginationDto,
  ) {
    return this.feedService.getHomeFeed(user.id, pagination);
  }

  @Get('explore')
  @ApiOperation({
    summary:
      'Explore: engagement-ranked recent posts from accounts you do not follow',
  })
  getExplore(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: CursorPaginationDto,
  ) {
    return this.feedService.getExplore(user.id, pagination);
  }
}
