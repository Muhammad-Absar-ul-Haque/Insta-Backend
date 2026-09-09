import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { FollowStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../media/cloudinary.service';
import {
  toUserSummary,
  USER_SUMMARY_SELECT,
} from '../common/utils/user-summary.util';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async getProfileByUsername(username: string, viewerId: number) {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });
    if (
      !user ||
      user.deletedAt ||
      (user.deactivatedAt && user.id !== viewerId)
    ) {
      throw new NotFoundException('User not found');
    }

    const [
      followerCount,
      followingCount,
      postCount,
      viewerFollow,
      blockedByOwner,
      blockedByViewer,
    ] = await Promise.all([
      this.prisma.follow.count({
        where: { followingId: user.id, status: FollowStatus.accepted },
      }),
      this.prisma.follow.count({
        where: { followerId: user.id, status: FollowStatus.accepted },
      }),
      this.prisma.post.count({ where: { userId: user.id, deletedAt: null } }),
      user.id === viewerId
        ? null
        : this.prisma.follow.findUnique({
            where: {
              followerId_followingId: {
                followerId: viewerId,
                followingId: user.id,
              },
            },
          }),
      this.prisma.blockedUser.findUnique({
        where: {
          blockerId_blockedId: { blockerId: user.id, blockedId: viewerId },
        },
      }),
      this.prisma.blockedUser.findUnique({
        where: {
          blockerId_blockedId: { blockerId: viewerId, blockedId: user.id },
        },
      }),
    ]);

    const isOwner = user.id === viewerId;
    const isFollowing = viewerFollow?.status === FollowStatus.accepted;
    const hasPendingRequest = viewerFollow?.status === FollowStatus.pending;
    const postsVisible = isOwner || !user.isPrivate || isFollowing;

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      bio: user.bio,
      website: user.website,
      avatarUrl: user.avatarUrl,
      isPrivate: user.isPrivate,
      isVerified: user.isVerified,
      followerCount,
      followingCount,
      postCount,
      isOwner,
      isFollowing,
      hasPendingRequest,
      postsVisible,
      isBlockedByOwner: Boolean(blockedByOwner),
      hasBlockedOwner: Boolean(blockedByViewer),
    };
  }

  async updateMe(userId: number, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });
    return toUserSummary(user);
  }

  async deactivateMe(userId: number): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { deactivatedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async deleteMe(userId: number, dto: DeleteAccountDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }
    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Incorrect password');
    }

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
  }

  async requestAvatarUpload(userId: number) {
    const signed = this.cloudinary.createSignedUpload(
      'avatars',
      userId,
      'image',
    );
    return { ...signed, avatarUrl: signed.cdnUrl };
  }

  async blockUser(blockerId: number, blockedId: number) {
    if (blockerId === blockedId) {
      throw new BadRequestException('You cannot block yourself');
    }
    const target = await this.prisma.user.findUnique({
      where: { id: blockedId },
    });
    if (!target || target.deletedAt) {
      throw new NotFoundException('User not found');
    }

    try {
      await this.prisma.$transaction([
        this.prisma.blockedUser.create({ data: { blockerId, blockedId } }),
        // Blocking severs any existing follow relationship in either direction.
        this.prisma.follow.deleteMany({
          where: {
            OR: [
              { followerId: blockerId, followingId: blockedId },
              { followerId: blockedId, followingId: blockerId },
            ],
          },
        }),
      ]);
    } catch {
      throw new ConflictException('User is already blocked');
    }
  }

  async unblockUser(blockerId: number, blockedId: number): Promise<void> {
    await this.prisma.blockedUser.deleteMany({
      where: { blockerId, blockedId },
    });
  }

  async listBlocked(userId: number) {
    const rows = await this.prisma.blockedUser.findMany({
      where: { blockerId: userId },
      include: { blocked: { select: USER_SUMMARY_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => toUserSummary(row.blocked));
  }

  async restrictUser(restrictorId: number, restrictedId: number) {
    if (restrictorId === restrictedId) {
      throw new BadRequestException('You cannot restrict yourself');
    }
    const target = await this.prisma.user.findUnique({
      where: { id: restrictedId },
    });
    if (!target || target.deletedAt) {
      throw new NotFoundException('User not found');
    }

    try {
      // Unlike blocking, restricting doesn't touch the follow relationship and
      // isn't announced to the restricted user in any way.
      await this.prisma.restrictedUser.create({
        data: { restrictorId, restrictedId },
      });
    } catch {
      throw new ConflictException('User is already restricted');
    }
  }

  async unrestrictUser(
    restrictorId: number,
    restrictedId: number,
  ): Promise<void> {
    await this.prisma.restrictedUser.deleteMany({
      where: { restrictorId, restrictedId },
    });
  }

  async listRestricted(userId: number) {
    const rows = await this.prisma.restrictedUser.findMany({
      where: { restrictorId: userId },
      include: { restricted: { select: USER_SUMMARY_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => toUserSummary(row.restricted));
  }

  async muteUser(
    muterId: number,
    mutedId: number,
    options: { mutePosts?: boolean; muteStories?: boolean },
  ) {
    if (muterId === mutedId) {
      throw new BadRequestException('You cannot mute yourself');
    }
    const target = await this.prisma.user.findUnique({
      where: { id: mutedId },
    });
    if (!target || target.deletedAt) {
      throw new NotFoundException('User not found');
    }

    const mutePosts = options.mutePosts ?? true;
    const muteStories = options.muteStories ?? true;
    await this.prisma.mutedUser.upsert({
      where: { muterId_mutedId: { muterId, mutedId } },
      create: { muterId, mutedId, mutePosts, muteStories },
      update: { mutePosts, muteStories },
    });
  }

  async unmuteUser(muterId: number, mutedId: number): Promise<void> {
    await this.prisma.mutedUser.deleteMany({ where: { muterId, mutedId } });
  }

  async listMuted(userId: number) {
    const rows = await this.prisma.mutedUser.findMany({
      where: { muterId: userId },
      include: { muted: { select: USER_SUMMARY_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      ...toUserSummary(row.muted),
      mutePosts: row.mutePosts,
      muteStories: row.muteStories,
    }));
  }

  /** "Who to follow" — the only bootstrap path out of an empty Home feed for a new
   * account. No interest graph to rank against yet, so this ranks by follower count
   * (a reasonable "popular accounts" heuristic) rather than anything personalized.
   * Follower counts here include pending requests to private accounts, not just
   * accepted follows — a deliberate simplification since this is a ranking signal,
   * not a displayed number, and Prisma's relation-count ordering can't filter by status. */
  async listSuggested(viewerId: number, limit: number) {
    const [alreadyRelated, blocked] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followerId: viewerId },
        select: { followingId: true },
      }),
      this.prisma.blockedUser.findMany({
        where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
        select: { blockerId: true, blockedId: true },
      }),
    ]);
    const excludedIds = new Set<number>([
      viewerId,
      ...alreadyRelated.map((f) => f.followingId),
      ...blocked.flatMap((b) => [b.blockerId, b.blockedId]),
    ]);

    const users = await this.prisma.user.findMany({
      where: {
        id: { notIn: [...excludedIds] },
        deletedAt: null,
        deactivatedAt: null,
        isBanned: false,
      },
      select: USER_SUMMARY_SELECT,
      orderBy: [{ followers: { _count: 'desc' } }, { id: 'desc' }],
      take: limit,
    });
    return users.map(toUserSummary);
  }
}
