import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { CursorPaginationDto } from '../common/dto/cursor-pagination.dto';
import { HashtagsService } from './hashtags.service';

@ApiTags('hashtags')
@ApiBearerAuth()
@Controller('hashtags')
export class HashtagsController {
  constructor(private readonly hashtagsService: HashtagsService) {}

  @Get(':tag')
  @ApiOperation({ summary: 'Get posts for a hashtag' })
  getByTag(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tag') tag: string,
    @Query() pagination: CursorPaginationDto,
  ) {
    return this.hashtagsService.getPostsByTag(tag, user.id, pagination);
  }
}
