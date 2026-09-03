import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { JwtAccessPayload } from '../../auth/strategies/jwt.strategy';

/**
 * Gateways authenticate at connection time (not per-message): the client sends its
 * access token as `auth.token` (or `?token=` as a fallback) on the Socket.IO handshake.
 */
export async function authenticateSocket(
  socket: Socket,
  jwt: JwtService,
  config: ConfigService,
): Promise<JwtAccessPayload> {
  const token =
    (socket.handshake.auth?.token as string | undefined) ??
    (socket.handshake.query?.token as string | undefined);

  if (!token) {
    throw new UnauthorizedException('Missing auth token');
  }

  try {
    return await jwt.verifyAsync<JwtAccessPayload>(token, {
      secret: config.get<string>('jwt.accessSecret'),
    });
  } catch {
    throw new UnauthorizedException('Invalid or expired token');
  }
}
