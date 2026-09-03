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

describe('Posts (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a post, fetches it, then deletes it', async () => {
    const author = await signup(app, 'poster');

    const createRes = await request(app.getHttpServer())
      .post('/api/posts')
      .set('Authorization', `Bearer ${author.accessToken}`)
      .send({
        caption: 'hello #world',
        media: [{ mediaType: 'image', contentType: 'image/jpeg' }],
      })
      .expect(201);

    expect(createRes.body.post.caption).toBe('hello #world');
    expect(createRes.body.uploads).toHaveLength(1);
    expect(createRes.body.uploads[0].uploadUrl).toContain('http');
    const postId = createRes.body.post.id as number;

    const getRes = await request(app.getHttpServer())
      .get(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${author.accessToken}`)
      .expect(200);
    expect(getRes.body.id).toBe(postId);
    expect(getRes.body.author.username).toBe(author.username);

    await request(app.getHttpServer())
      .delete(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${author.accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${author.accessToken}`)
      .expect(404);
  });

  it("prevents deleting another user's post", async () => {
    const author = await signup(app, 'owner');
    const intruder = await signup(app, 'intruder');

    const createRes = await request(app.getHttpServer())
      .post('/api/posts')
      .set('Authorization', `Bearer ${author.accessToken}`)
      .send({ media: [{ mediaType: 'image', contentType: 'image/jpeg' }] })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/posts/${createRes.body.post.id}`)
      .set('Authorization', `Bearer ${intruder.accessToken}`)
      .expect(403);
  });

  it('likes and saves a post', async () => {
    const author = await signup(app, 'liked');
    const liker = await signup(app, 'liker');

    const createRes = await request(app.getHttpServer())
      .post('/api/posts')
      .set('Authorization', `Bearer ${author.accessToken}`)
      .send({ media: [{ mediaType: 'image', contentType: 'image/jpeg' }] })
      .expect(201);
    const postId = createRes.body.post.id as number;

    await request(app.getHttpServer())
      .post(`/api/posts/${postId}/like`)
      .set('Authorization', `Bearer ${liker.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/posts/${postId}/save`)
      .set('Authorization', `Bearer ${liker.accessToken}`)
      .expect(204);

    const getRes = await request(app.getHttpServer())
      .get(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${liker.accessToken}`)
      .expect(200);
    expect(getRes.body.isLiked).toBe(true);
    expect(getRes.body.isSaved).toBe(true);
    expect(getRes.body.likeCount).toBe(1);
  });
});
