import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { authenticateSocket } from '../common/ws/authenticate-socket';
import { PresenceService } from '../redis/presence.service';
import { PrismaService } from '../prisma/prisma.service';

function conversationRoom(conversationId: number): string {
  return `conversation:${conversationId}`;
}

@WebSocketGateway({ namespace: '/ws/messages', cors: { origin: '*' } })
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagesGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly presence: PresenceService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const payload = await authenticateSocket(socket, this.jwt, this.config);
      socket.data.userId = payload.sub;
      await socket.join(`user:${payload.sub}`);
      await this.presence.addSocket(payload.sub, socket.id);
      await this.prisma.user.update({
        where: { id: payload.sub },
        data: { lastActiveAt: new Date() },
      });
    } catch (error) {
      this.logger.warn(`Rejected messages socket: ${(error as Error).message}`);
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: Socket) {
    const userId = socket.data.userId as number | undefined;
    if (userId) {
      await this.presence.removeSocket(userId, socket.id);
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastActiveAt: new Date() },
      });
    }
  }

  @SubscribeMessage('join_conversation')
  async onJoinConversation(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: number },
  ) {
    const userId = socket.data.userId as number;
    const isParticipant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: { conversationId: data.conversationId, userId },
      },
    });
    if (isParticipant) {
      await socket.join(conversationRoom(data.conversationId));
    }
  }

  @SubscribeMessage('typing')
  onTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: number },
  ) {
    socket.to(conversationRoom(data.conversationId)).emit('typing', {
      conversationId: data.conversationId,
      userId: socket.data.userId,
    });
  }

  pushMessage(conversationId: number, message: unknown): void {
    this.server.to(conversationRoom(conversationId)).emit('message', message);
  }
}
