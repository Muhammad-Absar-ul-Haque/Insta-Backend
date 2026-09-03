import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FollowStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../media/cloudinary.service';
import {
  toUserSummary,
  USER_SUMMARY_SELECT,
} from '../common/utils/user-summary.util';
import { UpdateProfileDto } from './dto/update-profile.dto';

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
    if (!user || user.deletedAt) {
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
}
