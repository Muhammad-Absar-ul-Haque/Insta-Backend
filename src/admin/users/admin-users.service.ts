import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildCursorArgs,
  toCursorPage,
} from '../../common/utils/pagination.util';
import { AdminAuditService } from '../admin-audit.service';
import { ListUsersQueryDto } from '../dto/list-users-query.dto';
import { ChangeRoleDto } from '../dto/change-role.dto';
import { AdminNotesDto } from '../dto/admin-notes.dto';

const ADMIN_USER_SELECT = {
  id: true,
  username: true,
  email: true,
  fullName: true,
  avatarUrl: true,
  role: true,
  isBanned: true,
  isVerified: true,
  isPrivate: true,
  lastLoginAt: true,
  deletedAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async list(query: ListUsersQueryDto) {
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.isBanned !== undefined
        ? { isBanned: query.isBanned === 'true' }
        : {}),
      ...(query.search
        ? {
            OR: [
              { username: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.user.findMany({
      where,
      select: ADMIN_USER_SELECT,
      ...buildCursorArgs(query),
    });
    return toCursorPage(rows, query.limit);
  }

  async getById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: ADMIN_USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async ban(adminId: number, userId: number, dto: AdminNotesDto) {
    const user = await this.mustFind(userId);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { isBanned: true },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.audit.log({
      adminId,
      actionType: 'ban_user',
      targetType: 'user',
      targetId: userId,
      notes: dto.notes,
    });
    return { ...user, isBanned: true };
  }

  async unban(adminId: number, userId: number, dto: AdminNotesDto) {
    await this.mustFind(userId);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { isBanned: false },
      select: ADMIN_USER_SELECT,
    });
    await this.audit.log({
      adminId,
      actionType: 'unban_user',
      targetType: 'user',
      targetId: userId,
      notes: dto.notes,
    });
    return user;
  }

  async verify(adminId: number, userId: number) {
    await this.mustFind(userId);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { isVerified: true },
      select: ADMIN_USER_SELECT,
    });
    await this.audit.log({
      adminId,
      actionType: 'verify_user',
      targetType: 'user',
      targetId: userId,
    });
    return user;
  }

  async changeRole(adminId: number, userId: number, dto: ChangeRoleDto) {
    if (adminId === userId) {
      throw new BadRequestException('You cannot change your own role');
    }
    await this.mustFind(userId);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role: dto.role },
      select: ADMIN_USER_SELECT,
    });
    await this.audit.log({
      adminId,
      actionType: 'change_role',
      targetType: 'user',
      targetId: userId,
      notes: `role -> ${dto.role}`,
    });
    return user;
  }

  async softDelete(
    adminId: number,
    userId: number,
    dto: AdminNotesDto,
  ): Promise<void> {
    await this.mustFind(userId);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { deletedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.audit.log({
      adminId,
      actionType: 'delete_user',
      targetType: 'user',
      targetId: userId,
      notes: dto.notes,
    });
  }

  private async mustFind(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: ADMIN_USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
