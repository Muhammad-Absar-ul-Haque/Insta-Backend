import {
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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { CursorPaginationDto } from '../common/dto/cursor-pagination.dto';
import { FollowsService } from './follows.service';

@ApiTags('follows')
@ApiBearerAuth()
@Controller('follows')
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Get('requests')
  @ApiOperation({
    summary: 'List pending follow requests sent to the current user',
  })
  listRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: CursorPaginationDto,
  ) {
    return this.followsService.listPendingRequests(user.id, pagination);
  }

  @Post('requests/:id/accept')
  @ApiOperation({ summary: 'Accept a pending follow request' })
  acceptRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.followsService.acceptRequest(user.id, id);
  }

  @Post('requests/:id/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reject a pending follow request' })
  rejectRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.followsService.rejectRequest(user.id, id);
  }

  @Post(':userId')
  @ApiOperation({
    summary: 'Follow a user (or send a request if their account is private)',
  })
  follow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.followsService.follow(user.id, userId);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unfollow a user (or cancel a pending request)' })
  unfollow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.followsService.unfollow(user.id, userId);
  }
}
