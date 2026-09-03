import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LikeTargetType } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { CursorPaginationDto } from '../common/dto/cursor-pagination.dto';
import { LikesService } from '../likes/likes.service';
import { ReelsService } from './reels.service';
import { CreateReelDto } from './dto/create-reel.dto';

@ApiTags('reels')
@ApiBearerAuth()
@Controller('reels')
export class ReelsController {
  constructor(
    private readonly reelsService: ReelsService,
    private readonly likesService: LikesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a reel; returns a presigned upload URL' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReelDto) {
    return this.reelsService.create(user.id, dto);
  }

  @Get('feed')
  @ApiOperation({ summary: 'Engagement-ranked reels feed' })
  getFeed(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: CursorPaginationDto,
  ) {
    return this.reelsService.getFeed(user.id, pagination);
  }

  @Post(':id/like')
  @ApiOperation({ summary: 'Like a reel' })
  like(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.likesService.like(user.id, LikeTargetType.reel, id);
  }

  @Delete(':id/like')
  @ApiOperation({ summary: 'Unlike a reel' })
  unlike(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.likesService.unlike(user.id, LikeTargetType.reel, id);
  }

  @Post(':id/view')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Record a view on a reel' })
  view(@Param('id', ParseIntPipe) id: number) {
    return this.reelsService.view(id);
  }
}
