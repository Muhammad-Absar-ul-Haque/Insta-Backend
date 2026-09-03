import { Injectable } from '@nestjs/common';
import { AdminActionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface LogAdminActionInput {
  adminId: number;
  actionType: AdminActionType;
  targetType: string;
  targetId: number;
  notes?: string;
}

/** Every mutating admin/moderator action writes here — this is the audit trail an
 * appeals process or a post-incident review would point at. */
@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: LogAdminActionInput): Promise<void> {
    await this.prisma.adminAction.create({ data: input });
  }
}
