import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { authenticateSocket } from '../common/ws/authenticate-socket';
import { PresenceService } from '../redis/presence.service';

@WebSocketGateway({ namespace: '/ws/notifications', cors: { origin: '*' } })
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly presence: PresenceService,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const payload = await authenticateSocket(socket, this.jwt, this.config);
      socket.data.userId = payload.sub;
      await socket.join(`user:${payload.sub}`);
      await this.presence.addSocket(payload.sub, socket.id);
    } catch (error) {
      this.logger.warn(
        `Rejected notifications socket: ${(error as Error).message}`,
      );
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: Socket) {
    const userId = socket.data.userId as number | undefined;
    if (userId) {
      await this.presence.removeSocket(userId, socket.id);
    }
  }

  pushToUser(userId: number, notification: unknown): void {
    this.server.to(`user:${userId}`).emit('notification', notification);
  }
}
