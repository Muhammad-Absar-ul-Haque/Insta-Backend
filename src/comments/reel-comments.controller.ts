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
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@ApiTags('comments')
@ApiBearerAuth()
@Controller('reels/:reelId/comments')
export class ReelCommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @ApiOperation({ summary: 'Comment on a reel' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reelId', ParseIntPipe) reelId: number,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.createTopLevel(user.id, 'reel', reelId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List top-level comments on a reel' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reelId', ParseIntPipe) reelId: number,
    @Query() pagination: CursorPaginationDto,
  ) {
    return this.commentsService.listForTarget(
      'reel',
      reelId,
      user.id,
      pagination,
    );
  }

  @Get('filtered')
  @ApiOperation({
    summary: 'Owner-only: comments auto-hidden by your blocked-keyword filter',
  })
  listFiltered(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reelId', ParseIntPipe) reelId: number,
    @Query() pagination: CursorPaginationDto,
  ) {
    return this.commentsService.listFiltered(
      user.id,
      'reel',
      reelId,
      pagination,
    );
  }

  @Post('disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Turn off commenting on a reel you own' })
  disable(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reelId', ParseIntPipe) reelId: number,
  ) {
    return this.commentsService.setCommentsDisabled(
      user.id,
      'reel',
      reelId,
      true,
    );
  }

  @Post('enable')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Turn commenting back on for a reel you own' })
  enable(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reelId', ParseIntPipe) reelId: number,
  ) {
    return this.commentsService.setCommentsDisabled(
      user.id,
      'reel',
      reelId,
      false,
    );
  }
}
