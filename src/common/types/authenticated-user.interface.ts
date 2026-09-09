import { Role } from '@prisma/client';

export interface AuthenticatedUser {
  id: number;
  username: string;
  role: Role;
  /** The `jti` of the refresh token that this access token was issued alongside — lets `GET /auth/sessions` mark the current session. */
  rjti?: string;
}
