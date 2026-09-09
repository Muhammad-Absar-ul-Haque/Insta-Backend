import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { CursorPaginationDto } from '../common/dto/cursor-pagination.dto';
import { ReelsService } from './reels.service';

@ApiTags('reels')
@ApiBearerAuth()
@Controller('users')
export class UserReelsController {
  constructor(private readonly reelsService: ReelsService) {}

  @Get(':userId/reels')
  @ApiOperation({ summary: "List a user's reels (their reels grid)" })
  listByUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseIntPipe) userId: number,
    @Query() pagination: CursorPaginationDto,
  ) {
    return this.reelsService.listByUser(userId, user.id, pagination);
  }
}
