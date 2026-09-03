import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { AdminUsersService } from './admin-users.service';
import { ListUsersQueryDto } from '../dto/list-users-query.dto';
import { ChangeRoleDto } from '../dto/change-role.dto';
import { AdminNotesDto } from '../dto/admin-notes.dto';

@ApiTags('admin/users')
@ApiBearerAuth()
@Roles(Role.admin, Role.moderator)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users, filterable by role/ban status/search' })
  list(@Query() query: ListUsersQueryDto) {
    return this.adminUsersService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user (admin view)' })
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.adminUsersService.getById(id);
  }

  @Patch(':id/ban')
  @ApiOperation({ summary: 'Ban a user' })
  ban(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminNotesDto,
  ) {
    return this.adminUsersService.ban(admin.id, id, dto);
  }

  @Patch(':id/unban')
  @ApiOperation({ summary: 'Unban a user' })
  unban(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminNotesDto,
  ) {
    return this.adminUsersService.unban(admin.id, id, dto);
  }

  @Patch(':id/verify')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Grant a user verified status (admin-only)' })
  verify(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.adminUsersService.verify(admin.id, id);
  }

  @Patch(':id/role')
  @Roles(Role.admin)
  @ApiOperation({ summary: "Change a user's role (admin-only)" })
  changeRole(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeRoleDto,
  ) {
    return this.adminUsersService.changeRole(admin.id, id, dto);
  }

  @Delete(':id')
  @Roles(Role.admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a user account (admin-only)' })
  softDelete(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminNotesDto,
  ) {
    return this.adminUsersService.softDelete(admin.id, id, dto);
  }
}
