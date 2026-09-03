import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { AdminContentService } from './admin-content.service';
import { ListContentQueryDto } from '../dto/list-content-query.dto';
import { AdminNotesDto } from '../dto/admin-notes.dto';

@ApiTags('admin/content')
@ApiBearerAuth()
@Roles(Role.admin, Role.moderator)
@Controller('admin')
export class AdminContentController {
  constructor(private readonly adminContentService: AdminContentService) {}

  @Get('posts')
  @ApiOperation({ summary: 'List posts for moderation' })
  listPosts(@Query() query: ListContentQueryDto) {
    return this.adminContentService.listPosts(query);
  }

  @Delete('posts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a post' })
  deletePost(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminNotesDto,
  ) {
    return this.adminContentService.deletePost(admin.id, id, dto);
  }

  @Get('comments')
  @ApiOperation({ summary: 'List comments for moderation' })
  listComments(@Query() query: ListContentQueryDto) {
    return this.adminContentService.listComments(query);
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a comment' })
  deleteComment(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminNotesDto,
  ) {
    return this.adminContentService.deleteComment(admin.id, id, dto);
  }

  @Get('reels')
  @ApiOperation({ summary: 'List reels for moderation' })
  listReels(@Query() query: ListContentQueryDto) {
    return this.adminContentService.listReels(query);
  }

  @Delete('reels/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a reel' })
  deleteReel(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminNotesDto,
  ) {
    return this.adminContentService.deleteReel(admin.id, id, dto);
  }
}
