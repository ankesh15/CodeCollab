# CodeCollab — Real-Time Collaborative Coding Platform

CodeCollab is a production-grade, full-stack monorepo platform engineered for software engineers, technical interviewers, and candidates to pair-program in real time, solve algorithmic challenges, execute multi-language code in sandboxed environments, track performance analytics, and collaborate seamlessly.

---

## 🛠️ Tech Stack & Monorepo Architecture

### Monorepo Architecture
- **Package Manager**: npm Workspaces (`apps/web`, `apps/server`, `packages/shared`).
- **Shared Contracts (`@codecollab/shared`)**: Single source of truth for DTOs, Zod validation schemas, and Socket.IO event contracts.

### Frontend (`apps/web`)
- **Framework**: React 18, TypeScript, Vite 5 SPA.
- **Styling**: Tailwind CSS (Custom Dark Mode UI & Glassmorphism design system).
- **Code Editor**: Monaco Code Editor (`@monaco-editor/react`), lazily chunked via `React.lazy()` to maintain an initial bundle under 180 KB.
- **Icons**: Lucide Icons.
- **Routing**: React Router v6 with `ProtectedRoute` guards and `ErrorBoundary` fallback UI.

### Backend (`apps/server`)
- **Runtime**: Node.js 20, TypeScript.
- **REST Framework**: Express.js with Zod payload validation.
- **Real-Time Signaling Engine**: Socket.IO 4.x with custom JWT handshake middleware.
- **Database & ORM**: PostgreSQL 16 with Prisma ORM.
- **Security & Reliability**: Helmet HTTP headers, tier-based rate limiting (`express-rate-limit`), correlation request tracing (`X-Request-ID`), structured logging.

### Infrastructure & DevOps
- **Containers**: Docker multi-stage builds (`apps/server/Dockerfile`, `apps/web/Dockerfile`).
- **Web Server & Reverse Proxy**: Nginx with SPA routing fallback (`try_files`) and WebSocket proxying (`Upgrade`/`Connection`).
- **Orchestration**: Docker Compose (`docker-compose.prod.yml`).
- **CI/CD Pipeline**: GitHub Actions workflow (`.github/workflows/ci.yml`).

---

## ✨ System Features & Phase Milestones

- [x] **Phase 1 — Monorepo Foundation**: Initialized npm workspace layout (`apps/web`, `apps/server`, `packages/shared`).
- [x] **Phase 2 — PostgreSQL + Prisma Database Architecture**: Relational schema containing 8 models (`User`, `Room`, `RoomMember`, `CodeDocument`, `Problem`, `TestCase`, `Submission`, `Message`, `Notification`) with index optimizations and cascade rules.
- [x] **Phase 3 — Authentication, JWT & RBAC**: Password hashing via `bcrypt` (12 salt rounds), stateless JWT auth, Zod payload validation, and room-level role-based authorization (`OWNER`, `ADMIN`, `MEMBER`).
- [x] **Phase 4 — Real-Time Socket.IO Signaling**: Isolated room communication, presence tracking, and JWT socket authorization.
- [x] **Phase 4.5 — Product UI Foundation**: Dark mode landing page, login/registration forms with show/hide password toggles, user dashboard, room discovery, and problem library.
- [x] **Phase 5 — Collaborative Monaco Editor Engine**: Real-time code synchronization (`editor:change`), cursor indicators (`editor:cursor`), language sync, monotonic versioning, stale edit protection, and debounced database persistence.
- [x] **Phase 6 — Secure Code Execution & Submissions**: Judge0 sandboxed code execution (C++, JavaScript, Python), public vs. hidden test evaluation, runtime/memory metrics, and real-time room submission notifications.
- [x] **Phase 7 — Real-Time Chat & Notification Center**: Room chat with cursor pagination and scroll detection (`↓ New messages`), system notification center with unread badges, and user-specific notification channels.
- [x] **Phase 8 — Leaderboards & Analytics Engine**: 30-day submission activity heatmap, difficulty breakdown charts, global & room-level leaderboard rankings, and performance metrics.
- [x] **Phase 9 — Production Security & Hardening**: Strict environment fail-fast checks, Helmet headers, tiered rate limiting, sanitized error formatting, `/api/health` & `/api/ready` probes, graceful shutdown handling, and automated security verification audit.
- [x] **Phase 10 — Docker & CI/CD Deployment Pipeline**: Multi-stage production container builds, Nginx SPA fallback & WebSocket reverse proxying, production Compose orchestration, and GitHub Actions CI workflow.
- [x] **Phase 11 — Product Polish & Portfolio Readiness**: Route code splitting (`React.lazy`), zero-data CTA states, disconnect warning banners, multi-user end-to-end test suite (`verify-e2e.ts`), and technical documentation.

---

## ⚡ Quick Start & Development Setup

### Prerequisites
- Node.js >= 20.x
- PostgreSQL 16 (Running locally or via Docker)

### 1. Installation
```bash
git clone https://github.com/your-username/CodeCollab.git
cd CodeCollab
npm install
```

### 2. Environment Setup
Copy the environment template and configure database credentials:
```bash
cp .env.example .env
```

### 3. Database Migration & Seeding
```bash
cd apps/server
npx prisma migrate dev --name init
npx prisma db seed
cd ../..
```

### 4. Running Development Servers
```bash
# Start backend server (Port 5000) & frontend Vite dev server (Port 5173)
npm run dev
```

---

## 🐳 Docker Production Deployment

To run the complete production stack locally using Docker Compose:

```bash
# Build and start all production services in background
docker-compose -f docker-compose.prod.yml up --build -d

# Verify server health
curl http://localhost/api/health

# Access web app in browser
# http://localhost (Port 80)
```

---

## 🧪 Automated Verification & Test Suite

CodeCollab features 9 automated TypeScript verification scripts covering database integrity, authentication, socket signaling, collaborative editing, sandboxed execution, chat, analytics, security, and end-to-end multi-user integration.

```bash
cd apps/server

# Execute Multi-User End-to-End Test Suite
npx ts-node src/scripts/verify-e2e.ts

# Execute Security & Rate Limiting Audit
npx ts-node src/scripts/verify-security.ts

# Execute Collaborative Editor Engine Audit
npx ts-node src/scripts/verify-editor.ts

# Full Monorepo Type Check & Linting
npm run type-check
npm run lint
```

---

## 💼 Resume Bullet Points

- **Architected a production-grade real-time collaborative coding platform** using Node.js, Express, TypeScript, React, and Socket.IO within an npm workspace monorepo.
- **Engineered a real-time collaborative code editor** using Monaco Editor and Socket.IO, implementing monotonic versioning (`v1, v2`), stale edit rejection, and debounced PostgreSQL persistence.
- **Implemented sandboxed multi-language code execution** (C++, JavaScript, Python) integrated with Judge0 API, evaluating public and hidden test cases with runtime/memory profiling.
- **Designed role-based authorization (RBAC)** and stateless JWT authentication, enforcing strict room privacy rules (`OWNER`, `ADMIN`, `MEMBER`) across REST API endpoints and WebSockets.
- **Optimized frontend bundle size by > 60%** using React `lazy()` route-based code splitting, decoupling Monaco Editor dependencies from initial page loads.
- **Containerized the application with Docker and Nginx**, building a production-ready reverse proxy pipeline with SPA fallback routing, WebSocket proxying, and automated GitHub Actions CI/CD workflows.

---

## 🎓 Technical Interview Q&A (System Design & Engineering)

### Q1: How do you handle concurrent code edits in the collaborative editor without causing race conditions or data loss?
**Answer**: CodeCollab enforces monotonic document versioning. Every room document tracks an integer version (`version`). When a client sends an `editor:change` event, it includes expected version `v + 1`. The server validates that the incoming edit targets the current version in memory. If a conflict occurs (stale version), the server rejects the edit and sends a `DOCUMENT_VERSION_CONFLICT` event, prompting the client to re-sync with the latest server state before accepting subsequent input. Additionally, database persistence is debounced (~250ms) to avoid overloading PostgreSQL during fast typing.

### Q2: How is Socket.IO traffic secured and isolated between rooms?
**Answer**: Socket connection handshake requests pass through a custom authentication middleware that verifies the user's JWT token. Authenticated socket instances are assigned user identity (`socket.user`). Room access is enforced when a socket emits `room:join`. The server checks the user's membership and room privacy settings in PostgreSQL before joining the socket to the isolated Socket.IO room channel (`room:${roomId}`). Non-members attempting to join private rooms receive a `FORBIDDEN` error event and are refused entry.

### Q3: How did you optimize frontend performance and bundle size?
**Answer**: Monaco Editor is a heavy library (~3 MB uncompressed). To prevent bloat on initial page load (landing page, login, dashboard), CodeCollab uses `React.lazy()` code splitting in `App.tsx`. Monaco Editor dependencies are chunked separately by Vite and loaded dynamically ONLY when a user navigates to an active workspace route (`/rooms/:roomId`), keeping initial page bundles below 180 KB gzipped.
