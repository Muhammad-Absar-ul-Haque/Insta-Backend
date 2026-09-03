import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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

    const conversation = await this.prisma.conversation.create({
      data: {
        isGroup,
        groupName: isGroup ? dto.groupName : null,
        participants: {
          create: [userId, ...otherIds].map((id) => ({ userId: id })),
        },
      },
      include: this.conversationInclude(),
    });

    return this.toConversationSummary(conversation, userId);
  }

  async listConversations(userId: number, pagination: CursorPaginationDto) {
    const memberships = await this.prisma.conversationParticipant.findMany({
      where: { userId },
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
      items: items.map((entry) =>
        this.toConversationSummary(entry.conversation, userId),
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
    await this.assertParticipant(userId, conversationId);

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

    const dtoOut = this.toMessageDto(message);
    this.gateway.pushMessage(conversationId, dtoOut);
    return dtoOut;
  }

  private async assertParticipant(
    userId: number,
    conversationId: number,
  ): Promise<void> {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) {
      throw new ForbiddenException('You are not part of this conversation');
    }
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
      participants: { include: { user: { select: USER_SUMMARY_SELECT } } },
      messages: {
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        include: { sender: { select: USER_SUMMARY_SELECT } },
      },
    };
  }

  private toConversationSummary(
    conversation: {
      id: number;
      isGroup: boolean;
      groupName: string | null;
      createdAt: Date;
      participants: {
        userId: number;
        lastReadMessageId: number | null;
        user: Parameters<typeof toUserSummary>[0];
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

    return {
      id: conversation.id,
      isGroup: conversation.isGroup,
      groupName: conversation.groupName,
      createdAt: conversation.createdAt,
      participants: conversation.participants
        .filter((p) => p.userId !== viewerId)
        .map((p) => toUserSummary(p.user)),
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
