import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { CursorPaginationDto } from '../common/dto/cursor-pagination.dto';
import { StoriesService } from './stories.service';
import { CreateStoryDto } from './dto/create-story.dto';

@ApiTags('stories')
@ApiBearerAuth()
@Controller('stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a story; returns a presigned upload URL' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStoryDto) {
    return this.storiesService.create(user.id, dto);
  }

  @Get('feed')
  @ApiOperation({
    summary: 'Active stories from followed users, grouped by author',
  })
  getFeed(@CurrentUser() user: AuthenticatedUser) {
    return this.storiesService.getFeed(user.id);
  }

  @Post(':id/view')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark a story as viewed' })
  view(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.storiesService.view(user.id, id);
  }

  @Get(':id/viewers')
  @ApiOperation({ summary: 'List who has viewed your story (owner-only)' })
  getViewers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Query() pagination: CursorPaginationDto,
  ) {
    return this.storiesService.getViewers(user.id, id, pagination);
  }
}
