import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, uniqueUsername } from './utils/test-app';

async function signup(app: INestApplication, prefix: string) {
  const username = uniqueUsername(prefix);
  const res = await request(app.getHttpServer())
    .post('/api/auth/signup')
    .send({
      username,
      email: `${username}@example.com`,
      password: 'S3curePassw0rd!',
    })
    .expect(201);
  return {
    username,
    accessToken: res.body.accessToken as string,
    userId: res.body.user.id as number,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Feed (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("shows a followed user's new post in the home feed", async () => {
    const follower = await signup(app, 'follower');
    const followee = await signup(app, 'followee');

    await request(app.getHttpServer())
      .post(`/api/follows/${followee.userId}`)
      .set('Authorization', `Bearer ${follower.accessToken}`)
      .expect(201);

    const createRes = await request(app.getHttpServer())
      .post('/api/posts')
      .set('Authorization', `Bearer ${followee.accessToken}`)
      .send({
        caption: 'feed test post',
        media: [{ mediaType: 'image', contentType: 'image/jpeg' }],
      })
      .expect(201);
    const postId = createRes.body.post.id as number;

    // Fan-out runs on a background BullMQ worker; poll briefly rather than assume a fixed delay.
    let found = false;
    for (let attempt = 0; attempt < 10 && !found; attempt++) {
      const feedRes = await request(app.getHttpServer())
        .get('/api/feed')
        .set('Authorization', `Bearer ${follower.accessToken}`)
        .expect(200);
      found = feedRes.body.items.some(
        (item: { id: number }) => item.id === postId,
      );
      if (!found) await sleep(300);
    }

    expect(found).toBe(true);
  }, 15000);

  it("does not show a stranger's post in the home feed", async () => {
    const viewer = await signup(app, 'viewer');
    const stranger = await signup(app, 'stranger');

    const createRes = await request(app.getHttpServer())
      .post('/api/posts')
      .set('Authorization', `Bearer ${stranger.accessToken}`)
      .send({ media: [{ mediaType: 'image', contentType: 'image/jpeg' }] })
      .expect(201);

    await sleep(500);

    const feedRes = await request(app.getHttpServer())
      .get('/api/feed')
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .expect(200);

    expect(
      feedRes.body.items.some(
        (item: { id: number }) => item.id === createRes.body.post.id,
      ),
    ).toBe(false);
  });
});
