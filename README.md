# Instagram Clone — Backend

A production-shaped Instagram clone backend: auth, profiles, posts, stories, reels, a hybrid fan-out feed, social graph, likes/comments, direct messages, realtime notifications, search, saved posts, reporting, and a full admin/moderation panel.

**Stack:** NestJS 10 (Express, CommonJS) · PostgreSQL via Prisma 6 · Redis + BullMQ · Cloudinary (media storage/delivery, signed client-side uploads) · Socket.IO (with the Redis adapter for multi-instance delivery) · JWT auth · Swagger.

## Prerequisites

- Node.js 20+
- Docker Desktop (for Postgres, Redis)
- A free [Cloudinary](https://cloudinary.com) account (for media storage)

## Setup

```bash
npm install
cp .env.example .env   # already done if you're reading this from the repo as generated
```

Fill in `.env`:
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` should be long random strings in any real deployment (`.env` ships with generated dev-only secrets).
- `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` from your Cloudinary dashboard (cloudinary.com/console) — required, the app won't generate valid upload signatures without real values here.

## Running the stack

```bash
docker compose up -d postgres redis   # infra only; run the API with npm for hot-reload
npx prisma migrate dev                 # creates the schema, run once and after schema.prisma changes
npm run start:dev
```

The API listens on `http://localhost:3000/api`. Swagger docs are at `http://localhost:3000/docs`.

To run everything (including the API) in Docker: `docker compose up --build`.

Media (avatars, posts, stories, reels) uploads directly from the client to Cloudinary using a signature this API generates — see [`docs/users.md`](./docs/users.md) for the exact flow. Nothing to stand up locally for this beyond a Cloudinary account.

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
