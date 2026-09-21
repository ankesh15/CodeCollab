# CodeCollab

## Real-Time Collaborative Coding Platform

[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16.x-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![Docker](https://img.shields.io/badge/Docker-Supported-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

CodeCollab is a real-time collaborative coding platform where developers can solve programming problems together, edit code simultaneously, execute code securely, communicate through room chat, and track their coding progress.

Repository: [https://github.com/ankesh15/CodeCollab](https://github.com/ankesh15/CodeCollab)

---

## Table of Contents

- [Product Overview](#product-overview)
- [Feature Implementation Status](#feature-implementation-status)
  - [Real / Working Features](#real--working-features)
  - [Partial Features](#partial-features)
  - [Simulated Features](#simulated-features)
  - [Current Limitations & Architectural Constraints](#current-limitations--architectural-constraints)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Database Schema & Performance](#database-schema--performance)
- [Security Engineering](#security-engineering)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Database Setup](#database-setup)
  - [Running Locally](#running-locally)
- [Testing & Verification](#testing--verification)
- [Docker Production Deployment](#docker-production-deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [API Reference](#api-reference)
- [Real-Time Signaling & Sockets](#real-time-signaling--sockets)
- [Code Execution Pipeline (Judge0)](#code-execution-pipeline-judge0)
- [Contributing](#contributing)
- [License](#license)

---

## Product Overview

CodeCollab provides a full-stack, monorepo-based workspace that merges competitive programming with collaborative pair programming. Developers can choose between solo practice and real-time room sessions, complete with synchronized Monaco code editing, sandboxed multi-language execution via Judge0, live presence tracking, persistent room chat, unread notification alerts, user analytics, and global leaderboards.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CODECOLLAB WORKSPACE                              │
├───────────────────────────────────┬─────────────────────────────────────────┤
│ Problem Description & Constraints │ Collaborative Monaco Code Editor        │
│                                   │ - Real-time synchronization             │
│ - Difficulty & Tags               │ - Multi-cursor & selection tracking     │
│ - Input / Output Formats          │ - C++, Python, JavaScript support       │
│ - Sample & Hidden Test Cases      │ - Version conflict rejection            │
├───────────────────────────────────┼─────────────────────────────────────────┤
│ Test Case Evaluation Panel        │ Real-Time Room Chat & Activity Feed    │
│ - Run Sample Tests                │ - Member presence indicators            │
│ - Submit to Judge0 Sandbox        │ - Cursor position updates               │
│ - Execution Time & Memory Stats   │ - Live submission announcements         │
└───────────────────────────────────┴─────────────────────────────────────────┘
```

---

## Feature Implementation Status

### Real / Working Features

- **JWT Authentication Lifecycle**: Short-lived access tokens (`15m`), long-lived refresh tokens (`7d`) stored strictly as SHA-256 hashes in PostgreSQL. Full refresh rotation with token theft reuse detection, server-side logout revocation, password-change invalidation, and account deactivation controls.
- **Role-Based Access Control (RBAC)**: Database-backed authorization for `USER` and `ADMIN` roles. Non-admins cannot access admin endpoints even with forged claims.
- **Problem Management**: Draft and published lifecycles for problems. Problem publication enforces at least 1 public and 1 hidden test case.
- **Hidden Test Case Isolation**: Non-admin users never receive hidden test inputs, outputs, execution times, or memory stats in responses.
- **Transactional Room Lifecycle**: Room creation atomically inserts Room, owner RoomMember (`OWNER`), and initial CodeDocument. Safe leave transfers ownership to next oldest member or cleanly deletes empty rooms with cascaded dependencies.
- **Public & Private Room Authorization**: Authenticated users can view and join public rooms; private rooms enforce strict membership checks.
- **Collaborative Editor**: Monaco Editor synchronized over Socket.IO with monotonic version tracking, conflict rejection (`DOCUMENT_VERSION_CONFLICT`), auto-resync, and remote cursor decorations.
- **Real Sandboxed Execution**: Powered by Judge0 with Base64 encoding/decoding, strict language allowlist (`cpp`, `javascript`, `python`), 64 KB code/stdin limits, and 10 KB output truncation. Runner failures deterministically record `SYSTEM_ERROR` without fake fallback overrides.
- **Persistent Room Chat**: Real-time room messaging over Socket.IO with PostgreSQL persistence, 2,000-character payload limits, and spam rate limiting.
- **Real-Time Notifications**: Unread counter badges, instant WebSocket delivery, bulk mark-as-read, and automatic trigger on submission results.
- **Scalable Leaderboard**: PostgreSQL window function query (`ROW_NUMBER() OVER (...)`) with database-side pagination (`LIMIT`/`OFFSET`) executing in ~11ms.
- **Analytics Engine**: 30-day activity calendar aggregated database-side in UTC using `TO_CHAR(createdAt AT TIME ZONE 'UTC', 'YYYY-MM-DD')`.
- **Express Trust Proxy & Rate Limiting**: `trust proxy: 1` configured for Nginx reverse proxy topology; fine-grained tiered rate limiters for auth, refresh, submissions, analytics, imports, and chat.

### Partial Features

- **Codeforces Problem Import**: Imports problem statements, tags, and sample test cases via the official Codeforces API. Imported problems are created in `DRAFT` status and require at least one hidden test case before an admin can publish them.

### Simulated Features

- **NONE**: All fake execution fallbacks (`fallbackSandboxExecution`) were completely eliminated in Phase 0. All code execution executes against real Judge0 sandboxes.

### Current Limitations & Architectural Constraints

- **Single-Instance Deployment**: Real-time room presence and editor caches (`presenceManager`, `documentVersionCache`, debounce timers) currently reside in Node.js server memory. Running multiple horizontal backend replicas requires integrating `@socket.io/redis-adapter` and a distributed Redis cache.
- **Judge0 Service Dependency**: Code execution requires a reachable Judge0 instance. By default, the application connects to public `https://ce.judge0.com`. For production deployments, a dedicated self-hosted Judge0 instance (ports `2358`/`2359`) is recommended.
- **AI-Assisted Features**: AI hint generation and code explanations are intentionally deferred and not yet implemented.

---

## Architecture & Tech Stack

- **Monorepo**: npm workspaces (`apps/server`, `apps/web`, `packages/shared`)
- **Backend API**: Node.js 20, Express 4, TypeScript 5, Prisma 5, Socket.IO 4, Helmet, bcrypt, jsonwebtoken, express-rate-limit, Zod
- **Frontend App**: React 18, Vite 5, Tailwind CSS, Monaco Editor (`@monaco-editor/react`), Lucide React, Socket.IO Client
- **Shared Workspace**: TypeScript types, DTO contracts, event names, language enums
- **Database**: PostgreSQL 16
- **Reverse Proxy**: Nginx (Alpine) with SPA routing, WebSocket upgrade support, and API proxying

---

## Database Schema & Performance

The PostgreSQL relational schema managed via Prisma (`apps/server/prisma/schema.prisma`) includes:

- `User`: Accounts, credentials (`passwordHash`), roles (`USER`, `ADMIN`), active status (`isActive`), and timestamps.
- `RefreshToken`: Cryptographic SHA-256 token hashes (`tokenHash`), expiration dates, revocation timestamps (`revokedAt`), and indexed on `[userId, expiresAt]`.
- `Problem`: Challenge statements, difficulty, tags, status (`DRAFT`, `PUBLISHED`), source (`INTERNAL`, `CODEFORCES`).
- `TestCase`: Problem test cases, flagged as public sample or hidden, with inputs and expected outputs.
- `Room`: Collaborative coding rooms, privacy settings (`isPrivate`), languages, and owner relation.
- `RoomMember`: Room memberships with roles (`OWNER`, `ADMIN`, `MEMBER`) and unique constraint `@@unique([roomId, userId])`.
- `CodeDocument`: Room editor documents with monotonically increasing version numbers (`version`) and starter code.
- `Submission`: Code submissions, language, status, execution metrics, composite indexes `@@index([userId, status, problemId])` and `@@index([status, createdAt])`.
- `Message`: Persistent room chat messages.
- `Notification`: User notifications with read status.

---

## Security Engineering

- **No Raw Refresh Tokens**: Refresh tokens are stored strictly as SHA-256 hashes in PostgreSQL.
- **Refresh Rotation & Theft Reuse Detection**: Re-using an already-revoked refresh token invalidates all active sessions for that user family.
- **Bcrypt DoS Defense**: Strict 128-character maximum length prevents compute-heavy hashing denial of service.
- **Registration Race Handling**: Clean interception of Prisma `P2002` uniqueness constraints returns 409 Conflict instead of 500 errors.
- **Express Trust Proxy**: `trust proxy: 1` correctly forwards real client IPs from Nginx `X-Forwarded-For`.
- **Strict Production CORS**: Rejects unauthorized or missing origins in production with HTTP 403.
- **Information Leakage Sanitization**: `/api/ready` and database health probes suppress internal credentials, hostnames, and stack traces.
- **Production Docker Isolation**: Internal PostgreSQL (`5432`) and Node API (`5000`) ports are not bound to the host. Only Nginx (`8080:80`) is exposed publicly. Missing secrets fail deployment immediately via `${VAR:?error}`.

---

## Project Structure

```
CodeCollab/
├── apps/
│   ├── server/                   # Express REST API & Socket.IO server
│   │   ├── prisma/               # Schema, migrations, seeds
│   │   ├── src/
│   │   │   ├── config/           # Environment, rate-limiting, execution config
│   │   │   ├── controllers/      # Route controllers
│   │   │   ├── middlewares/      # Authentication, RBAC, error handling
│   │   │   ├── routes/           # REST endpoints
│   │   │   ├── schemas/          # Zod validation schemas
│   │   │   ├── scripts/          # Automated verification test suite
│   │   │   ├── services/         # Business logic & Judge0 sandbox client
│   │   │   └── socket/           # Socket.IO handlers
│   │   ├── Dockerfile
│   │   └── package.json
│   └── web/                      # React SPA client
│       ├── src/
│       │   ├── components/       # Monaco editor, room chat, navbar, UI cards
│       │   ├── context/          # Auth context with silent refresh
│       │   ├── lib/              # API client and Socket.IO singleton
│       │   └── pages/            # Application pages
│       ├── test/                 # Frontend contract & static verification
│       ├── Dockerfile
│       ├── nginx.conf
│       └── package.json
├── packages/
│   └── shared/                   # Shared TypeScript contracts & DTOs
├── .github/
│   └── workflows/                # GitHub Actions CI pipeline
├── docker-compose.yml            # Local PostgreSQL service
├── docker-compose.prod.yml       # Production stack (Postgres, Server, Web)
├── .env.example                  # Environment configuration template
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js**: `v20.x` or higher
- **npm**: `v9.x` or higher
- **PostgreSQL**: `v16.x` (or Docker)
- **Docker & Docker Compose**: Recommended for database and production builds

### Installation

```bash
git clone https://github.com/ankesh15/CodeCollab.git
cd CodeCollab
npm install
```

### Environment Variables

Copy the environment template:

```bash
cp .env.example .env
```

Configure `.env`:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration (PostgreSQL)
POSTGRES_USER=codecollab_user
POSTGRES_PASSWORD=codecollab_dev_pass
POSTGRES_DB=codecollab_db
POSTGRES_HOST=localhost
POSTGRES_PORT=5433

# Prisma Database URL
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public

# JWT Secrets (Minimum 32 characters in production)
JWT_SECRET=super_secret_jwt_access_token_key_at_least_32_chars!
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=super_secret_jwt_refresh_token_key_at_least_32_chars!
JWT_REFRESH_EXPIRES_IN=7d

# Client Configuration
VITE_API_BASE_URL=http://localhost:5000/api
CORS_ORIGIN=http://localhost:5173

# Sandboxed Code Execution Service (Judge0)
CODE_RUNNER_URL=https://ce.judge0.com
CODE_RUNNER_API_KEY=
```

### Database Setup

1. Start PostgreSQL:
```bash
npm run db:up
```

2. Generate Prisma Client and apply schema:
```bash
npm run db:generate
npm run db:migrate
```

3. Seed initial development users, problems, and rooms:
```bash
npm run db:seed --workspace=apps/server
```

### Running Locally

Start backend and frontend development servers concurrently:

```bash
npm run dev
```

- **Frontend App**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000/api`
- **Health Check**: `http://localhost:5000/api/health`

---

## Testing & Verification

CodeCollab includes a complete automated test and verification suite:

```bash
# Run core test suites (P2 security suite + Frontend contract suite)
npm test

# Run all 15 automated verification test suites
npm run test:all

# Individual verification scripts:
npx ts-node -r dotenv/config --cwd apps/server src/scripts/verify-db.ts
npx ts-node -r dotenv/config --cwd apps/server src/scripts/verify-auth.ts
npx ts-node -r dotenv/config --cwd apps/server src/scripts/verify-admin-role.ts
npx ts-node -r dotenv/config --cwd apps/server src/scripts/verify-admin-problems.ts
npx ts-node -r dotenv/config --cwd apps/server src/scripts/verify-socket.ts
npx ts-node -r dotenv/config --cwd apps/server src/scripts/verify-editor.ts
npx ts-node -r dotenv/config --cwd apps/server src/scripts/verify-chat.ts
npx ts-node -r dotenv/config --cwd apps/server src/scripts/verify-notifications.ts
npx ts-node -r dotenv/config --cwd apps/server src/scripts/verify-analytics.ts
npx ts-node -r dotenv/config --cwd apps/server src/scripts/verify-security.ts
npx ts-node -r dotenv/config --cwd apps/server src/scripts/verify-p0-execution.ts
npx ts-node -r dotenv/config --cwd apps/server src/scripts/verify-p1-rooms.ts
npx ts-node -r dotenv/config --cwd apps/server src/scripts/verify-p2-security.ts
npx ts-node -r dotenv/config --cwd apps/server src/scripts/verify-e2e.ts
node apps/web/test/verify-frontend.mjs

# Strict TypeScript type check across all workspaces
npm run type-check

# ESLint standard verification
npm run lint

# Production bundle compilation
npm run build
```

---

## Docker Production Deployment

To run the complete production topology:

```bash
# Provide mandatory production secrets in your environment or .env:
export POSTGRES_PASSWORD=your_secure_password
export JWT_SECRET=your_32_char_production_access_secret!
export JWT_REFRESH_SECRET=your_32_char_production_refresh_secret!

# Build and start services in background
docker compose -f docker-compose.prod.yml up --build -d

# Check running services
docker compose -f docker-compose.prod.yml ps

# View unified logs
docker compose -f docker-compose.prod.yml logs -f

# Stop containers
docker compose -f docker-compose.prod.yml down
```

In production, **only port 8080** (Nginx) is exposed to the public host. PostgreSQL (5432) and Node.js (5000) remain strictly private on the internal Docker network.

---

## CI/CD Pipeline

The GitHub Actions CI workflow (`.github/workflows/ci.yml`) runs on every commit and PR to `main`:

1. Installs monorepo dependencies (`npm ci`).
2. Generates the Prisma client.
3. Builds the shared contracts package.
4. Executes strict TypeScript type-checking across all packages (`npm run type-check`).
5. Runs ESLint code standards verification (`npm run lint`).
6. Provisions a PostgreSQL 16 service container, pushes the schema, and seeds test data.
7. Compiles production builds (`npm run build`).
8. Executes all automated verification test suites.
9. Builds multi-stage Docker container images for `apps/server` and `apps/web`.

---

## API Reference

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Register new user account (returns access token & refresh token)
- `POST /api/auth/login` — Authenticate via email or username
- `POST /api/auth/refresh` — Rotate refresh token and issue new access token
- `POST /api/auth/logout` — Revoke active refresh token on server
- `POST /api/auth/change-password` — Change password and invalidate all active user sessions
- `POST /api/auth/deactivate` — Deactivate account and revoke all tokens
- `GET /api/auth/me` — Fetch current user profile
- `PATCH /api/auth/me` — Update username or profile details (strictly validated)

### Rooms (`/api/rooms`)
- `GET /api/rooms` — List public coding rooms
- `POST /api/rooms` — Atomically create room, owner membership, and initial document
- `GET /api/rooms/:roomId` — Retrieve room metadata (public read permitted for public rooms)
- `PATCH /api/rooms/:roomId` — Update room settings (owner or admin only)
- `DELETE /api/rooms/:roomId` — Delete room and cascade dependencies (owner or admin only)
- `POST /api/rooms/:roomId/join` — Join room idempotently
- `POST /api/rooms/:roomId/leave` — Leave room (handles member leave, owner transfer, or room cleanup)
- `GET /api/rooms/:roomId/document` — Fetch room code document
- `PATCH /api/rooms/:roomId/document/language` — Update editor document language
- `GET /api/rooms/:roomId/messages` — Fetch paginated room chat messages
- `DELETE /api/messages/:messageId` — Delete room chat message (author, owner, or admin)
- `GET /api/rooms/:roomId/leaderboard` — Fetch room-specific problem leaderboard

### Problems (`/api/problems`)
- `GET /api/problems` — List published coding problems
- `GET /api/problems/:problemId` — Retrieve published problem statement and sample test cases
- `GET /api/problems/:problemId/statistics` — Retrieve problem solve and submission statistics

### Submissions (`/api/submissions`)
- `POST /api/submissions/run` — Run code against public sample test cases via Judge0
- `POST /api/submissions` — Submit code for full evaluation against public and hidden test cases
- `GET /api/submissions/problem/:problemId` — Retrieve user submission history for problem

### Analytics & Leaderboards (`/api/leaderboard`, `/api/analytics`)
- `GET /api/leaderboard` — Global user ranking via PostgreSQL window function with pagination
- `GET /api/analytics/me` — Fetch personal submission statistics and rank
- `GET /api/analytics/me/activity` — 30-day activity heatmap aggregated database-side in UTC

### Notifications (`/api/notifications`)
- `GET /api/notifications` — Fetch paginated user notifications
- `GET /api/notifications/unread-count` — Fetch unread count badge number
- `PATCH /api/notifications/:id/read` — Mark single notification as read
- `PATCH /api/notifications/read-all` — Bulk mark all notifications as read

### Admin (`/api/admin`)
- `GET /api/admin/problems` — List all draft and published problems
- `POST /api/admin/problems` — Create new problem in `DRAFT` status
- `PUT /api/admin/problems/:problemId` — Update problem statement and limits
- `POST /api/admin/problems/:problemId/test-cases` — Add public or hidden test case
- `PATCH /api/admin/problems/:problemId/publish` — Publish problem (validates >=1 public & >=1 hidden test cases)
- `POST /api/admin/problems/import/codeforces` — Import problem metadata from Codeforces API

### Health & Readiness (`/api`)
- `GET /api/health` — Liveness check
- `GET /api/ready` — Readiness check with sanitized database connectivity status

---

## Real-Time Signaling & Sockets

Socket.IO handles real-time signaling over authenticated WebSocket channels:

- `room:join` / `room:leave` — Presence management and member change broadcasts.
- `editor:change` — Monotonically versioned code edits; rejects stale versions with `DOCUMENT_VERSION_CONFLICT`.
- `editor:cursor` — Collaborator cursor coordinates for Monaco decorations.
- `editor:language` — Language switching synchronization.
- `message:send` / `message:delete` — Persistent room chat messaging with length and spam rate limiters.
- `notification:new` / `notification:count` — Real-time user alert dispatch.
- `submission:completed` — Broadcasts submission results to room members.

---

## Code Execution Pipeline (Judge0)

```
Client Code Submission (POST /api/submissions)
    │
    ▼
Express Backend Validation
    │  - Strict language allowlist (cpp, javascript, python)
    │  - 64 KB code & stdin size limit
    │  - Problem publication & test case verification
    ▼
Judge0 Sandbox API (Base64 Encoded)
    │  - Isolated cgroup container
    │  - CPU & memory resource limits
    │  - Base64 response decoding & 10 KB output truncation
    ▼
Test Case Evaluation & Scoring
    │  - Public test case feedback
    │  - Hidden test case evaluation (strictly isolated from client)
    ▼
PostgreSQL Transaction & Notification
    │  - Submission status recorded
    │  - Solved count incremented on ACCEPTED
    ▼
Socket.IO Event Broadcast to Room
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Verify tests and linting (`npm test && npm run lint`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

---

## License

This project is licensed under the MIT License.
