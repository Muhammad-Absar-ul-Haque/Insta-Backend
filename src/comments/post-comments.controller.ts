import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { CursorPaginationDto } from '../common/dto/cursor-pagination.dto';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@ApiTags('comments')
@ApiBearerAuth()
@Controller('posts/:postId/comments')
export class PostCommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @ApiOperation({ summary: 'Comment on a post' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId', ParseIntPipe) postId: number,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.createTopLevel(user.id, postId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List top-level comments on a post' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('postId', ParseIntPipe) postId: number,
    @Query() pagination: CursorPaginationDto,
  ) {
    return this.commentsService.listForPost(postId, user.id, pagination);
  }
}
