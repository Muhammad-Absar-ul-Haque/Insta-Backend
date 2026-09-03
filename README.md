# Instagram Clone — Backend

A production-shaped Instagram clone backend: auth, profiles, posts, stories, reels, a hybrid fan-out feed, social graph, likes/comments, direct messages, realtime notifications, search, saved posts, reporting, and a full admin/moderation panel.

**Stack:** NestJS 10 (Express, CommonJS) · PostgreSQL via Prisma 6 · Redis + BullMQ · S3-compatible storage (MinIO locally) · Socket.IO (with the Redis adapter for multi-instance delivery) · JWT auth · Swagger.

## Prerequisites

- Node.js 20+
- Docker Desktop (for Postgres, Redis, MinIO)

## Setup

```bash
npm install
cp .env.example .env   # already done if you're reading this from the repo as generated
```

Fill in `.env` — `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` should be long random strings in any real deployment (`.env` ships with generated dev-only secrets).

## Running the stack

```bash
docker compose up -d postgres redis minio   # infra only; run the API with npm for hot-reload
npx prisma migrate dev                       # creates the schema, run once and after schema.prisma changes
npm run start:dev
```

The API listens on `http://localhost:3000/api`. Swagger docs are at `http://localhost:3000/docs`.

To run everything (including the API) in Docker: `docker compose up --build`.

MinIO's console is at `http://localhost:9001` (user/pass: `minioadmin` / `minioadmin`) — create the bucket named in `S3_BUCKET` (`insta-clone-media` by default) before uploading media through the app.

## Tests

```bash
npm run test        # unit tests — no external services required
npm run test:e2e     # e2e tests — require the docker-compose stack running
```

## Project layout

Each feature is its own Nest module under `src/` (`auth`, `users`, `follows`, `posts`, `stories`, `reels`, `feed`, `likes`, `comments`, `saved`, `hashtags`, `messages`, `notifications`, `search`, `reports`, `admin`, `jobs`). `src/jobs` holds every BullMQ processor (feed fan-out, story expiry, hashtag extraction, notification dispatch, media processing, report escalation) plus the queue registrations. `src/common` holds cross-cutting pieces: guards, decorators, pagination, DTO base classes.

Admin/moderator endpoints live under `/api/admin/*`, gated by `RolesGuard` + `@Roles(...)` — see `src/admin/admin.module.ts` for the full permission matrix (moderators handle content/reports/bans; role changes, verification, account deletion, and stats are admin-only).

## API documentation

For interactive testing, use Swagger (`/docs`). For a detailed, per-module written reference — endpoint-by-endpoint request/response shapes, auth rules, business logic, and edge cases that Swagger's auto-generated docs don't capture — see [`docs/`](./docs/README.md).
