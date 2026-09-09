import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FollowStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PostsService } from '../posts/posts.service';
import { CloudinaryService } from '../media/cloudinary.service';
import { PresenceService } from '../redis/presence.service';
import { MessagesGateway } from './messages.gateway';
import { CursorPaginationDto } from '../common/dto/cursor-pagination.dto';
import {
  buildCursorArgs,
  paginateArray,
  toCursorPage,
} from '../common/utils/pagination.util';
import {
  toUserSummary,
  USER_SUMMARY_SELECT,
} from '../common/utils/user-summary.util';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MessagesGateway,
    private readonly postsService: PostsService,
    private readonly cloudinary: CloudinaryService,
    private readonly presence: PresenceService,
  ) {}

  async createConversation(userId: number, dto: CreateConversationDto) {
    const otherIds = [...new Set(dto.participantIds)].filter(
      (id) => id !== userId,
    );
    if (otherIds.length === 0) {
      throw new BadRequestException(
        'A conversation needs at least one other participant',
      );
    }

    const others = await this.prisma.user.findMany({
      where: { id: { in: otherIds }, deletedAt: null },
    });
    if (others.length !== otherIds.length) {
      throw new BadRequestException('One or more participants do not exist');
    }

    const isGroup = dto.isGroup ?? otherIds.length > 1;

    if (!isGroup) {
      if (otherIds.length !== 1) {
        throw new BadRequestException(
          'A 1:1 conversation needs exactly one other participant',
        );
      }
      const existing = await this.findExistingDirectConversation(
        userId,
        otherIds[0],
      );
      if (existing) {
        return this.toConversationSummary(existing, userId);
      }
    }

    const recipientRequestStatus = isGroup
      ? FollowStatus.accepted
      : await this.determineRequestStatus(otherIds[0], userId);

    const conversation = await this.prisma.conversation.create({
      data: {
        isGroup,
        groupName: isGroup ? dto.groupName : null,
        participants: {
          create: [
            { userId, requestStatus: FollowStatus.accepted },
            ...otherIds.map((id) => ({
              userId: id,
              requestStatus: recipientRequestStatus,
            })),
          ],
        },
      },
      include: this.conversationInclude(),
    });

    return this.toConversationSummary(conversation, userId);
  }

  /** A 1:1 message from someone the recipient doesn't follow — or someone the
   * recipient has restricted — lands as a pending request rather than a normal
   * conversation, matching Instagram's message-requests behavior. */
  private async determineRequestStatus(
    recipientId: number,
    senderId: number,
  ): Promise<FollowStatus> {
    const [recipientFollowsSender, isRestricted] = await Promise.all([
      this.prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: recipientId,
            followingId: senderId,
          },
        },
      }),
      this.prisma.restrictedUser.findUnique({
        where: {
          restrictorId_restrictedId: {
            restrictorId: recipientId,
            restrictedId: senderId,
          },
        },
      }),
    ]);
    const follows = recipientFollowsSender?.status === FollowStatus.accepted;
    return follows && !isRestricted
      ? FollowStatus.accepted
      : FollowStatus.pending;
  }

  async listConversations(userId: number, pagination: CursorPaginationDto) {
    return this.listByRequestStatus(userId, FollowStatus.accepted, pagination);
  }

  /** Pending 1:1 conversations from people the current user doesn't follow (or has restricted). */
  async listRequests(userId: number, pagination: CursorPaginationDto) {
    return this.listByRequestStatus(userId, FollowStatus.pending, pagination);
  }

  async acceptRequest(userId: number, conversationId: number): Promise<void> {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) {
      throw new NotFoundException('Conversation request not found');
    }
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { requestStatus: FollowStatus.accepted },
    });
  }

  async rejectRequest(userId: number, conversationId: number): Promise<void> {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant || participant.requestStatus !== FollowStatus.pending) {
      throw new NotFoundException('Conversation request not found');
    }
    await this.prisma.conversation.delete({ where: { id: conversationId } });
  }

  private async listByRequestStatus(
    userId: number,
    requestStatus: FollowStatus,
    pagination: CursorPaginationDto,
  ) {
    const memberships = await this.prisma.conversationParticipant.findMany({
      where: { userId, requestStatus },
      select: { conversationId: true },
    });

    const conversations = await this.prisma.conversation.findMany({
      where: { id: { in: memberships.map((m) => m.conversationId) } },
      include: this.conversationInclude(),
    });

    const sorted = conversations
      .map((c) => ({
        conversation: c,
        lastMessageAt: c.messages[0]?.createdAt ?? c.createdAt,
      }))
      .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
      .map((entry) => ({
        id: entry.conversation.id,
        conversation: entry.conversation,
      }));

    const { items, nextCursor } = paginateArray(
      sorted,
      pagination.cursor,
      pagination.limit,
    );
    return {
      items: await Promise.all(
        items.map((entry) =>
          this.toConversationSummary(entry.conversation, userId),
        ),
      ),
      nextCursor,
    };
  }

  async listMessages(
    userId: number,
    conversationId: number,
    pagination: CursorPaginationDto,
  ) {
    await this.assertParticipant(userId, conversationId);

    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      include: { sender: { select: USER_SUMMARY_SELECT } },
      ...buildCursorArgs(pagination),
    });
    const { items, nextCursor } = toCursorPage(rows, pagination.limit);

    if (!pagination.cursor && items.length > 0) {
      await this.prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { lastReadMessageId: items[0].id },
      });
    }

    return { items: items.map((m) => this.toMessageDto(m)), nextCursor };
  }

  async sendMessage(
    userId: number,
    conversationId: number,
    dto: SendMessageDto,
  ) {
    const participant = await this.assertParticipant(userId, conversationId);

    if (dto.messageType === 'post_share') {
      const postId = Number(dto.content);
      if (!Number.isInteger(postId)) {
        throw new BadRequestException(
          'content must be the shared post id for post_share messages',
        );
      }
      // Reuses the same visibility check GET /posts/:id enforces — 404 if the post
      // is gone, 403 if it's private and the sender doesn't follow its author.
      await this.postsService.getById(postId, userId);
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        messageType: dto.messageType,
        content: dto.content,
        mediaUrl: dto.mediaUrl,
      },
      include: { sender: { select: USER_SUMMARY_SELECT } },
    });

    // Sending a message into a still-pending request is how the recipient implicitly
    // accepts it — matches Instagram (replying to a request accepts it).
    if (participant.requestStatus === FollowStatus.pending) {
      await this.prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { requestStatus: FollowStatus.accepted },
      });
    }

    const dtoOut = this.toMessageDto(message);
    this.gateway.pushMessage(conversationId, dtoOut);
    return dtoOut;
  }

  async requestMediaUpload(
    userId: number,
    conversationId: number,
    mediaType: 'image' | 'video',
  ) {
    await this.assertParticipant(userId, conversationId);
    return this.cloudinary.createSignedUpload(
      `messages/${conversationId}`,
      userId,
      mediaType,
    );
  }

  private async assertParticipant(userId: number, conversationId: number) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) {
      throw new ForbiddenException('You are not part of this conversation');
    }
    return participant;
  }

  private async findExistingDirectConversation(
    userId: number,
    otherId: number,
  ) {
    const candidates = await this.prisma.conversation.findMany({
      where: { isGroup: false, participants: { some: { userId } } },
      include: this.conversationInclude(),
    });
    return candidates.find(
      (c) =>
        c.participants.length === 2 &&
        c.participants.some((p) => p.userId === otherId),
    );
  }

  private conversationInclude() {
    return {
      participants: {
        include: {
          user: {
            select: {
              ...USER_SUMMARY_SELECT,
              showActivityStatus: true,
              lastActiveAt: true,
            },
          },
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        include: { sender: { select: USER_SUMMARY_SELECT } },
      },
    };
  }

  private async toConversationSummary(
    conversation: {
      id: number;
      isGroup: boolean;
      groupName: string | null;
      createdAt: Date;
      participants: {
        userId: number;
        lastReadMessageId: number | null;
        user: Parameters<typeof toUserSummary>[0] & {
          showActivityStatus: boolean;
          lastActiveAt: Date | null;
        };
      }[];
      messages: Array<Parameters<ConversationsService['toMessageDto']>[0]>;
    },
    viewerId: number,
  ) {
    const lastMessage = conversation.messages[0] ?? null;
    const viewerParticipant = conversation.participants.find(
      (p) => p.userId === viewerId,
    );
    const unread = Boolean(
      lastMessage &&
      lastMessage.id !== viewerParticipant?.lastReadMessageId &&
      lastMessage.senderId !== viewerId,
    );
    const viewerSharesActivityStatus =
      viewerParticipant?.user.showActivityStatus ?? false;

    const others = conversation.participants.filter(
      (p) => p.userId !== viewerId,
    );
    const participants = await Promise.all(
      others.map(async (p) => {
        const shareable =
          viewerSharesActivityStatus && p.user.showActivityStatus;
        return {
          ...toUserSummary(p.user),
          activityStatus: shareable
            ? {
                isOnline: await this.presence.isOnline(p.userId),
                lastActiveAt: p.user.lastActiveAt,
              }
            : null,
        };
      }),
    );

    return {
      id: conversation.id,
      isGroup: conversation.isGroup,
      groupName: conversation.groupName,
      createdAt: conversation.createdAt,
      participants,
      lastMessage: lastMessage ? this.toMessageDto(lastMessage) : null,
      unread,
    };
  }

  private toMessageDto(message: {
    id: number;
    conversationId: number;
    senderId: number;
    content: string | null;
    mediaUrl: string | null;
    messageType: string;
    createdAt: Date;
    sender: Parameters<typeof toUserSummary>[0];
  }) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      content: message.content,
      mediaUrl: message.mediaUrl,
      messageType: message.messageType,
      createdAt: message.createdAt,
      sender: toUserSummary(message.sender),
    };
  }
}
