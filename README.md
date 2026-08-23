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
- [Why CodeCollab?](#why-codecollab)
- [Features](#features)
- [User Flow](#user-flow)
- [Admin Workflow](#admin-workflow)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Database Overview](#database-overview)
- [Security & Engineering](#security--engineering)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Database Setup](#database-setup)
  - [Running the Application](#running-the-application)
- [Development Admin Account](#development-admin-account)
- [Testing & Verification](#testing--verification)
- [Docker Deployment](#docker-deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [API Overview](#api-overview)
- [Real-Time Architecture](#real-time-architecture)
- [Code Execution](#code-execution)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [What I Built](#what-i-built)
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
│ - Sample & Hidden Test Cases      │                                         │
├───────────────────────────────────┼─────────────────────────────────────────┤
│ Test Case Evaluation Panel        │ Real-Time Room Chat & Activity Feed    │
│ - Run Sample Tests                │ - Member presence indicators            │
│ - Submit to Judge0 Sandbox        │ - Cursor position updates               │
│ - Execution Time & Memory Stats   │ - Live submission announcements         │
└───────────────────────────────────┴─────────────────────────────────────────┘
```

---

## Why CodeCollab?

Traditional competitive programming platforms are optimized strictly for individual practice. When developers want to pair-program, interview, or solve algorithmic challenges together, they must switch between separate code editors, screen-sharing tools, external chat applications, and manual code execution environments.

CodeCollab solves this friction by consolidating problem reading, real-time code collaboration, multi-language sandboxed execution, room communication, and user analytics into a unified web application.

---

## Features

| Feature | Description |
|---|---|
| **Authentication** | JWT-based stateless authentication supporting login via email or username |
| **Role-Based Access (RBAC)** | Strict server-enforced `USER` and `ADMIN` permission policies |
| **Problem Library** | Categorized coding challenges with difficulty tiers, tags, and constraints |
| **Admin Problem Management** | Full CRUD for problems, including draft/published states and status controls |
| **Codeforces Import** | Automated problem metadata importer using the official Codeforces API |
| **Test Case Management** | Public sample test cases and hidden evaluation test cases per problem |
| **Collaborative Editor** | Monaco-based code workspace with syntax highlighting and theme support |
| **Real-Time Sync** | Socket.IO code synchronization with monotonic version conflict resolution |
| **Secure Execution** | Isolated multi-language code execution powered by Judge0 sandbox API |
| **Submissions** | Code submission pipeline with runtime, memory profiling, and status tracking |
| **Room Chat** | Real-time persistent room messaging with unread badges and pagination |
| **Notifications** | Real-time Socket.IO and persistent database notification system |
| **Leaderboards** | Global and room-level rankings based on accepted problem count and points |
| **Analytics Engine** | User profile submission activity heatmaps and difficulty breakdowns |
| **Security & Reliability** | Helmet headers, CORS policies, tiered rate limiting, and sanitized error outputs |
| **Docker Infrastructure** | Multi-stage Docker builds and production Docker Compose configuration |
| **CI/CD Pipeline** | GitHub Actions workflow executing type checking, linting, seeding, and verification suites |

---

## User Flow

### Solo & Room Practice Flow

```
Landing Page
    │
    ▼
Register / Login (Email or Username)
    │
    ▼
Profile / Problems Library
    │
    ├───────────────────────────────┐
    ▼                               ▼
Solo Practice                     Room Session (Create / Join)
    │                               │
    ▼                               ▼
Monaco Editor               Collaborative Monaco Editor
    │                        (Real-time Code & Cursor Sync + Chat)
    │                               │
    └───────────────┬───────────────┘
                    │
                    ▼
          Run Sample / Submit Code
                    │
                    ▼
             Judge0 Sandbox
                    │
                    ▼
     Execution Result & Test Evaluation
                    │
                    ▼
     Profile Analytics & Leaderboard Update
```

---

## Admin Workflow

Only authenticated users with the `ADMIN` role can access problem management tools.

```
Admin User Login
    │
    ▼
Admin Panel (/admin/problems)
    │
    ├─────────────────────────────────────────┐
    ▼                                         ▼
Create Problem Manually                   Import from Codeforces API
    │                                         │
    └────────────────────┬────────────────────┘
                         │
                         ▼
             Add Public & Hidden Test Cases
                         │
                         ▼
                    Save as DRAFT
              (Hidden from public library)
                         │
                         ▼
                  Publish Problem
                         │
                         ▼
             Available in Public Library
```

> [!NOTE]
> Draft problems are strictly hidden from standard users and public API endpoints until published by an Admin.

---

## Tech Stack

| Layer | Technologies Used |
|---|---|
| **Frontend** | React 18, TypeScript, Vite 5, Tailwind CSS, Monaco Editor (`@monaco-editor/react`), React Router v6, Lucide Icons |
| **Backend** | Node.js 20, Express.js 4, TypeScript, Socket.IO 4, JWT (`jsonwebtoken`), Zod, bcrypt |
| **Database** | PostgreSQL 16, Prisma ORM 5 |
| **Code Execution** | Judge0 API (Sandboxed C++, Python 3, JavaScript execution) |
| **Infrastructure** | Docker, Nginx, Docker Compose, GitHub Actions CI |
| **Monorepo Tools** | npm Workspaces (`apps/web`, `apps/server`, `packages/shared`) |

---

## Architecture

```
                    ┌──────────────────────────────────┐
                    │            React Web             │
                    │    (Vite + TypeScript + SPA)     │
                    └────────────────┬─────────────────┘
                                     │
                             HTTP / WebSockets
                                     │
                                     ▼
                    ┌──────────────────────────────────┐
                    │       Express API Server         │
                    │   (Node.js + Socket.IO + JWT)    │
                    └────────┬─────────┬─────────┬─────┘
                             │         │         │
                             ▼         │         ▼
                    ┌──────────────┐   │   ┌──────────────┐
                    │  PostgreSQL  │   │   │  Socket.IO   │
                    │ (Prisma ORM) │   │   │  Real-Time   │
                    └──────────────┘   │   └──────────────┘
                                       ▼
                                ┌──────────────┐
                                │    Judge0    │
                                │ Sandbox API  │
                                └──────────────┘
```

---

## Database Overview

The relational PostgreSQL database is managed via Prisma ORM and contains 9 core models:

```
┌──────────┐       1:N       ┌──────────┐       1:N       ┌──────────────┐
│   User   ├─────────────────┤   Room   ├─────────────────┤ CodeDocument │
└────┬─────┘                 └────┬─────┘                 └──────────────┘
     │                            │
     │ 1:N                        │ 1:N
     ▼                            ▼
┌────────────┐               ┌──────────┐
│ Submission │               │ Message  │
└────┬───────┘               └──────────┘
     │
     │ N:1
     ▼
┌────────────┐       1:N       ┌──────────┐
│  Problem   ├─────────────────┤ TestCase │
└────────────┘                 └──────────┘
```

- **User**: Authentication credentials, hashed password, role (`USER` | `ADMIN`), profile details.
- **Room**: Collaboration room configuration, owner reference, default language, privacy flag.
- **CodeDocument**: Room document state, language, and integer version for conflict resolution.
- **RoomMember**: Junction table managing room membership and room roles (`OWNER`, `ADMIN`, `MEMBER`).
- **Problem**: Problem statement, difficulty (`EASY`, `MEDIUM`, `HARD`), constraints, status (`DRAFT`, `PUBLISHED`).
- **TestCase**: Evaluation test cases linked to problems, marked as public sample or hidden.
- **Submission**: Execution record storing code, language, status result, runtime, and memory metrics.
- **Message**: Persistent room chat messages.
- **Notification**: System and user notification records (`ROOM_INVITE`, `SUBMISSION_RESULT`, etc.).

---

## Security & Engineering

CodeCollab enforces security at the backend boundary:

- **Database-Backed Authorization**: Privilege checks (such as Admin operations) perform authoritative database lookups rather than trusting JWT payload claims alone.
- **Stateless JWT Authentication**: Secure token verification with strict expiration and user identity validation.
- **Security Headers**: Express application hardened with `helmet` for HTTP header protection.
- **CORS Restrictions**: Configured origin validation for API and Socket.IO servers.
- **Tiered Rate Limiting**: Endpoint rate limiting to protect authentication and code submission endpoints from abuse.
- **Request Tracing**: Unique `X-Request-ID` generation per request for distributed logging and correlation.
- **Data Redaction**: Logger automatically redacts sensitive fields like `password`, `token`, and `passwordHash`.
- **Hidden Test Case Isolation**: Hidden test inputs and expected outputs are never exposed to non-admin client APIs.
- **Socket Guards**: Socket.IO payload size limits and rapid-fire event rate limiters prevent socket spamming.
- **Sandboxed Execution**: User code runs inside isolated containers managed by Judge0 with execution timeouts.

---

## Project Structure

```
CodeCollab/
├── apps/
│   ├── server/                   # Express REST API & Socket.IO server
│   │   ├── prisma/               # Database schema, migrations, and seeds
│   │   │   ├── migrations/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   ├── src/
│   │   │   ├── config/           # Environment and security configuration
│   │   │   ├── controllers/      # Route handler logic
│   │   │   ├── middlewares/      # Auth, RBAC, error, and logging middlewares
│   │   │   ├── routes/           # REST API endpoints
│   │   │   ├── schemas/          # Zod validation schemas
│   │   │   ├── scripts/          # Automated verification test suite
│   │   │   ├── services/         # Business logic & external API services
│   │   │   ├── socket/           # Socket.IO handlers (presence, editor, chat)
│   │   │   └── utils/            # JWT, logger, and comparator utilities
│   │   ├── Dockerfile
│   │   └── package.json
│   └── web/                      # React SPA web application
│       ├── src/
│       │   ├── components/       # Reusable UI components
│       │   ├── context/          # Auth state provider
│       │   ├── lib/              # API and Socket.IO client instances
│       │   └── pages/            # Application routes & workspace views
│       ├── Dockerfile
│       ├── nginx.conf
│       ├── tailwind.config.js
│       └── package.json
├── packages/
│   └── shared/                   # Shared TypeScript types and contracts
├── .github/
│   └── workflows/                # GitHub Actions CI pipeline
│       └── ci.yml
├── docker-compose.yml            # Local development database orchestration
├── docker-compose.prod.yml       # Production stack orchestration
├── .env.example                  # Environment configuration template
├── package.json                  # Root monorepo workspace configuration
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js**: `v20.x` or higher
- **npm**: `v9.x` or higher
- **PostgreSQL**: `v16.x` (Running locally or via Docker)

### Installation

Clone the repository and install all monorepo dependencies:

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

Configure your local `.env` variables as needed:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration (PostgreSQL)
POSTGRES_USER=codecollab_user
POSTGRES_PASSWORD=your_secure_postgres_password_here
POSTGRES_DB=codecollab_db
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# Prisma Database Connection URL
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public

# JWT Authentication Secrets
JWT_SECRET=your_jwt_secret_key_change_in_production
JWT_EXPIRES_IN=7d

# Client Configuration
VITE_API_BASE_URL=http://localhost:5000/api
CORS_ORIGIN=http://localhost:5173

# Sandboxed Code Execution Service Configuration
CODE_RUNNER_URL=https://ce.judge0.com
CODE_RUNNER_API_KEY=your_optional_judge0_api_key
```

### Database Setup

1. Start the PostgreSQL database container (or use a local instance):

```bash
npm run db:up
```

2. Generate the Prisma Client and run migrations:

```bash
npm run db:generate
npm run db:migrate
```

3. Seed initial development data (users, rooms, problems, and test cases):

```bash
npm run db:seed --workspace=apps/server
```

### Running the Application

Start both the backend server and frontend development server concurrently:

```bash
npm run dev
```

- **Frontend Application**: `http://localhost:5173`
- **Backend REST API**: `http://localhost:5000/api`
- **API Health Probe**: `http://localhost:5000/api/health`

---

## Development Admin Account

The database seed script initializes a default development Admin account for testing administrative capabilities (creating/editing problems, importing Codeforces challenges, and managing test cases).

Refer to the seed configuration (`apps/server/prisma/seed.ts`) for local development credentials.

---

## Testing & Verification

CodeCollab includes automated verification test scripts located in `apps/server/src/scripts/` that validate system subsystems:

### Code Quality Commands

```bash
# Monorepo strict type-check
npm run type-check

# Monorepo lint check
npm run lint

# Compile production builds
npm run build
```

### Verification Test Scripts

```bash
cd apps/server

# Database connectivity and schema constraints
npx ts-node src/scripts/verify-db.ts

# Authentication, JWT, and email/username login flows
npx ts-node src/scripts/verify-auth.ts

# Admin RBAC permission enforcement
npx ts-node src/scripts/verify-admin-role.ts

# Admin problem CRUD and Codeforces import
npx ts-node src/scripts/verify-admin-problems.ts

# Real-time Socket.IO signaling and presence
npx ts-node src/scripts/verify-socket.ts

# Collaborative Monaco editor versioning and sync
npx ts-node src/scripts/verify-editor.ts

# Code execution and Judge0 submission pipeline
npx ts-node src/scripts/verify-submission.ts

# Room chat persistence and events
npx ts-node src/scripts/verify-chat.ts

# Real-time and persistent notifications
npx ts-node src/scripts/verify-notifications.ts

# Analytics aggregation and leaderboards
npx ts-node src/scripts/verify-analytics.ts

# Rate-limiting, security headers, and error sanitization
npx ts-node src/scripts/verify-security.ts

# Multi-user End-to-End integration test suite
npx ts-node src/scripts/verify-e2e.ts
```

---

## Docker Deployment

To launch the full production environment using Docker Compose:

```bash
# Build and start all production services (PostgreSQL, Express Server, Nginx Web Server)
docker-compose -f docker-compose.prod.yml up --build -d

# Check service logs
docker-compose -f docker-compose.prod.yml logs -f

# Verify API health
curl http://localhost:5000/api/health

# Stop production containers
docker-compose -f docker-compose.prod.yml down
```

---

## CI/CD Pipeline

CodeCollab uses GitHub Actions (`.github/workflows/ci.yml`) to enforce code quality on every push and pull request to `main`:

1. **Environment Setup**: Provisions Node.js 20 with dependency caching and a PostgreSQL 16 service container.
2. **Type Checking & Linting**: Executes `npm run type-check` and `npm run lint`.
3. **Database Migration & Seeding**: Runs Prisma migrations and seeds test data against the test database.
4. **Verification Suites**: Executes automated verification scripts (`verify-db`, `verify-auth`, `verify-socket`, `verify-editor`, `verify-submission`, `verify-chat`, `verify-notifications`, `verify-analytics`, `verify-security`).
5. **Docker Build Validation**: Validates multi-stage Docker builds for `apps/server` and `apps/web`.

---

## API Overview

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Register new user account
- `POST /api/auth/login` — Authenticate via email or username
- `GET /api/auth/me` — Fetch current user profile

### Problems (`/api/problems`)
- `GET /api/problems` — List published coding problems (supports difficulty/tag filters)
- `GET /api/problems/:id` — Retrieve published problem details and sample test cases

### Admin Problem Management (`/api/admin/problems`)
- `GET /api/admin/problems` — List all draft and published problems
- `POST /api/admin/problems` — Create new problem statement
- `GET /api/admin/problems/:id` — Retrieve problem details (including hidden test cases)
- `PUT /api/admin/problems/:id` — Update problem metadata
- `DELETE /api/admin/problems/:id` — Delete problem
- `PATCH /api/admin/problems/:id/publish` — Toggle problem publication status (`DRAFT` / `PUBLISHED`)
- `POST /api/admin/problems/:id/test-cases` — Create test case for problem
- `POST /api/admin/problems/import/codeforces` — Import problem metadata from Codeforces API

### Rooms (`/api/rooms`)
- `GET /api/rooms` — List public coding rooms
- `POST /api/rooms` — Create new collaboration room
- `GET /api/rooms/:id` — Retrieve room details and code document
- `POST /api/rooms/:id/join` — Join room membership
- `DELETE /api/rooms/:id/leave` — Leave room

### Submissions (`/api/submissions`)
- `POST /api/submissions/run` — Run code against sample test cases via Judge0
- `POST /api/submissions/submit` — Submit code for full test suite evaluation
- `GET /api/submissions` — Retrieve submission history
- `GET /api/submissions/:id` — Retrieve specific submission details

### Analytics & Leaderboards (`/api/analytics`)
- `GET /api/analytics/user` — Fetch user submission statistics and activity metrics
- `GET /api/analytics/leaderboard` — Retrieve global user rankings

### Notifications (`/api/notifications`)
- `GET /api/notifications` — Fetch user notifications
- `GET /api/notifications/unread-count` — Get count of unread notifications
- `PATCH /api/notifications/:id/read` — Mark specific notification as read
- `PATCH /api/notifications/read-all` — Mark all notifications as read

---

## Real-Time Architecture

Socket.IO manages real-time signaling over authenticated WebSocket connections:

- **Presence Tracking**: Emits `room:joined` and `room:left` events, notifying room members of active participants.
- **Collaborative Editor**: Syncs code edits via `editor:change`, updates cursor positions via `editor:cursor`, and syncs active language changes via `editor:language`.
- **Monotonic Versioning**: Server tracks document version numbers to prevent race conditions and resolve edit conflicts.
- **Room Chat**: Delivers real-time chat messages via `chat:message` with persistent database storage.
- **Submissions & Notifications**: Dispatches live submission completion alerts and notifications across isolated socket channels.

---

## Code Execution

User code is executed safely outside the API server process using Judge0:

```
Client Code Submission
    │
    ▼
CodeCollab Backend
    │
    ▼
Judge0 Sandbox API (https://ce.judge0.com)
    │  - Isolated container execution
    │  - Runtime & memory limits
    │  - Multi-language support (C++, Python, JS)
    ▼
Execution Result & Test Case Comparison
    │
    ▼
Submission Recorded in PostgreSQL
    │
    ▼
Real-Time Result Dispatched to Client
```

---

## Roadmap

Planned future features and enhancements:

- **Cloud Deployment Infrastructure**: Automated deployment manifests for AWS / Cloud infrastructure.
- **Redis Socket.IO Adapter**: Horizontal scaling across multi-node server clusters using Redis Pub/Sub.
- **OAuth 2.0 Integration**: Third-party authentication via GitHub and Google.
- **Expanded Language Runtimes**: Added support for Rust, Go, and Java execution environments.
- **Contest & Match Mode**: Timed competitive programming tournaments with live scoreboards.
- **Editorials & Discussion Boards**: Problem discussion forums and official solution walk-throughs.
- **AI-Assisted Coding**: Opt-in AI code explanations and hint generation.
- **WebRTC Integration**: Peer-to-peer audio and video communication channels inside rooms.

---

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Verify tests and linting (`npm run type-check && npm run lint`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

---

## What I Built

Engineering highlights of the CodeCollab implementation:

- **Monorepo Architecture**: Clean separation of packages (`@codecollab/web`, `@codecollab/server`, `@codecollab/shared`) with TypeScript shared contracts.
- **Real-Time Synchronization**: Robust Socket.IO implementation featuring versioned document state management and presence tracking.
- **Database & Query Design**: PostgreSQL relational schema designed with Prisma ORM, featuring index optimizations for real-time lookups.
- **Sandboxed Execution Pipeline**: Multi-language code execution engine integrated with Judge0 API, evaluating both sample and hidden test cases.
- **Security Engineering**: Server-side RBAC enforcement, database-backed role authorization, request correlation tracing, rate limiting, and sensitive data sanitization.
- **Production DevOps**: Multi-stage Docker container builds, Nginx reverse proxy configuration, and GitHub Actions CI automation.

---

## License

License information will be added separately.
