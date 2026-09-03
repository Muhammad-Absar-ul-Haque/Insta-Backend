import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { CursorPaginationDto } from '../common/dto/cursor-pagination.dto';
import { PostsService } from './posts.service';

@ApiTags('posts')
@ApiBearerAuth()
@Controller('users')
export class UserPostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get(':userId/posts')
  @ApiOperation({ summary: "List a user's posts" })
  listByUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseIntPipe) userId: number,
    @Query() pagination: CursorPaginationDto,
  ) {
    return this.postsService.listByUser(userId, user.id, pagination);
  }
}
