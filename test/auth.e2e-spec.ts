import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, uniqueUsername } from './utils/test-app';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('signs up, logs in, refreshes, and logs out', async () => {
    const username = uniqueUsername('auth');
    const email = `${username}@example.com`;
    const password = 'S3curePassw0rd!';

    const signupRes = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({ username, email, password })
      .expect(201);

    expect(signupRes.body.user.username).toBe(username);
    expect(signupRes.body.accessToken).toBeDefined();
    expect(signupRes.body.refreshToken).toBeDefined();

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ usernameOrEmail: username, password })
      .expect(200);
    expect(loginRes.body.accessToken).toBeDefined();

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ usernameOrEmail: username, password: 'wrong-password' })
      .expect(401);

    const refreshRes = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken })
      .expect(200);
    expect(refreshRes.body.accessToken).toBeDefined();

    // The rotated-out token should no longer work.
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .send({ refreshToken: refreshRes.body.refreshToken })
      .expect(204);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: refreshRes.body.refreshToken })
      .expect(401);
  });

  it('rejects a duplicate username', async () => {
    const username = uniqueUsername('dup');
    const payload = {
      username,
      email: `${username}@example.com`,
      password: 'S3curePassw0rd!',
    };

    await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send(payload)
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({ ...payload, email: `other_${payload.email}` })
      .expect(409);
  });

  it('rejects protected routes without a token', async () => {
    await request(app.getHttpServer()).get('/api/feed').expect(401);
  });
});
