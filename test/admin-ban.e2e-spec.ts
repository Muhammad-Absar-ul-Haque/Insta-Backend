import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { Role } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, uniqueUsername } from './utils/test-app';

async function signup(app: INestApplication, prefix: string) {
  const username = uniqueUsername(prefix);
  const password = 'S3curePassw0rd!';
  const res = await request(app.getHttpServer())
    .post('/api/auth/signup')
    .send({ username, email: `${username}@example.com`, password })
    .expect(201);
  return {
    username,
    password,
    accessToken: res.body.accessToken as string,
    userId: res.body.user.id as number,
  };
}

describe('Admin ban flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('lets an admin ban a user, who then cannot log in, and records the action in the audit log', async () => {
    const target = await signup(app, 'target');
    const adminAccount = await signup(app, 'admin');

    // Promoting to admin isn't exposed over the API on purpose (see PATCH /admin/users/:id/role,
    // which itself requires an existing admin) — the fixture reaches into Prisma directly.
    await prisma.user.update({
      where: { id: adminAccount.userId },
      data: { role: Role.admin },
    });

    const adminLoginRes = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({
        usernameOrEmail: adminAccount.username,
        password: adminAccount.password,
      })
      .expect(200);
    const adminToken = adminLoginRes.body.accessToken as string;

    await request(app.getHttpServer())
      .patch(`/api/admin/users/${target.userId}/ban`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'e2e test ban' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ usernameOrEmail: target.username, password: target.password })
      .expect(401);

    const auditRes = await request(app.getHttpServer())
      .get(`/api/admin/audit-log?adminId=${adminAccount.userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      auditRes.body.items.some(
        (entry: { actionType: string; targetId: number }) =>
          entry.actionType === 'ban_user' && entry.targetId === target.userId,
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .patch(`/api/admin/users/${target.userId}/unban`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ usernameOrEmail: target.username, password: target.password })
      .expect(200);
  });

  it('rejects a non-admin account at /admin/auth/login and blocks admin routes for regular users', async () => {
    const regular = await signup(app, 'regular');

    await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ usernameOrEmail: regular.username, password: regular.password })
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${regular.accessToken}`)
      .expect(403);
  });
});
