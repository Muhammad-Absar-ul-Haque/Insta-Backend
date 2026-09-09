import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';
import { ListSavedQueryDto } from './dto/list-saved-query.dto';
import { SavedService } from './saved.service';

@ApiTags('saved')
@ApiBearerAuth()
@Controller('users/me/saved')
export class SavedController {
  constructor(private readonly savedService: SavedService) {}

  @Get()
  @ApiOperation({ summary: 'List the current user’s saved posts' })
  listSaved(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListSavedQueryDto,
  ) {
    return this.savedService.listSaved(user.id, query, query.collection);
  }

  @Get('collections')
  @ApiOperation({ summary: 'List the collections you have saved posts into' })
  listCollections(@CurrentUser() user: AuthenticatedUser) {
    return this.savedService.listCollections(user.id);
  }
}
