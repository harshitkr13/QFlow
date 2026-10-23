# QFlow — Virtual Queue & Appointment Management Platform

[![QFlow CI Pipeline](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)
[![Node Version](https://img.shields.io/badge/node-22.x%20%7C%2024.x-brightgreen.svg)](https://nodejs.org/)
[![NPM Version](https://img.shields.io/badge/npm-%3E%3D10.0.0-blue.svg)](https://www.npmjs.com/)
[![React 19](https://img.shields.io/badge/react-19.0.0-cyan.svg)](https://react.dev/)
[![Express 4](https://img.shields.io/badge/express-4.21.2-lightgrey.svg)](https://expressjs.com/)
[![MongoDB Mongoose](https://img.shields.io/badge/mongoose-8.10.0-green.svg)](https://mongoosejs.com/)
[![Vite](https://img.shields.io/badge/vite-6.1.0-purple.svg)](https://vitejs.dev/)

> **"Don't just book an appointment. Know when you actually need to reach the clinic."**

QFlow is an enterprise-grade Virtual Queue and Appointment Management Platform engineered for outpatient healthcare clinics. It synchronizes scheduled online appointments, physical walk-in triage, live queue tracking, doctor consultation workflows, financial billing, automated day-end settlement, and administrative governance into a single deterministic system.

---

## 1. System Architecture

QFlow employs a decoupled, production-optimized cloud topology separating static client delivery from stateless backend execution:

```
                                ┌───────────────────────────────────────┐
                                │        Vercel Edge Network            │
                                │   Single Page Application (Vite/React)│
                                │   Static Assets: src/client/dist      │
                                └───────────────────┬───────────────────┘
                                                    │
                   ┌────────────────────────────────┴────────────────────────────────┐
                   │                                                                 │
                   ▼ Browser Request                                                 ▼ API Reverse Proxy (/api/*)
       ┌────────────────────────┐                                      ┌─────────────────────────────┐
       │     End User Client    │                                      │    Render Cloud Service     │
       │  (Desktop / Mobile)    │◄────── Direct / Reverse Proxy ───────┤   Express.js API Engine     │
       │  - Patient Experience  │                                      │   Node.js 22.x / 24.x ESM Runtime  │
       │  - Staff Reception     │                                      └──────────────┬──────────────┘
       │  - Doctor Workspace    │                                                     │
       │  - Admin Governance    │                                                     │ Mongoose TLS Protocol
       └────────────────────────┘                                                     ▼
                                                                       ┌─────────────────────────────┐
                                                                       │    MongoDB Atlas Cluster    │
                                                                       │    M0+ Replica Set Database │
                                                                       │    - Multi-Doc Transactions │
                                                                       │    - Compound Unique Indexes│
                                                                       │    - 2dsphere Geo-Indexes   │
                                                                       └─────────────────────────────┘
```

### Architectural Highlights
- **Backend API**: Node.js (22.x / 24.x) and Express 4 in ECMAScript Modules (`"type": "module"`), featuring graceful shutdown (`SIGTERM`/`SIGINT`), strict CORS policy, rate limiting, and security headers.
- **Frontend Single-Page App**: React 19 and Vite 6 with pure CSS design tokens, responsive typography, and mobile-first consultation views.
- **Data Persistence**: MongoDB with Mongoose 8 utilizing WiredTiger replica sets for atomic multi-document transactions during walk-in token generation and day-end settlement closure.
- **Containerless CI/CD**: 100% bare-metal execution in GitHub Actions using `mongodb-memory-server` replica sets—**strictly zero Docker dependency**.

---

## 2. Prerequisites

Ensure your host environment meets the following requirements before installation:

| Requirement | Supported Version | Verification Command | Notes |
| :--- | :--- | :--- | :--- |
| **Node.js** | `22.x || 24.x` (Supported LTS lines: Node 22.x, Node 24.x; CI: 24.x) | `node --version` | Enforced via `package.json` engines |
| **npm** | `>= 10.0.0` | `npm --version` | Lockfile version 3 |
| **Git** | `>= 2.30.0` | `git --version` | Version control |
| **MongoDB** | Remote Atlas or Local Replica Set | `mongosh --version` | Only required for dev/prod (tests run in-memory) |

---

## 3. Local Development Setup

### 3.1 Clone the Repository
```bash
git clone https://github.com/OWNER/REPO.git
cd project
```

### 3.2 Install Dependencies
Install root and client dependencies with a single command:
```bash
npm install
```

### 3.3 Configure Environment Variables
Create a `.env` file in the project root:
```bash
cp .env.example .env
```

Populate `.env` with your development credentials:
```env
# Server Network Port
PORT=5000

# MongoDB Connection String (Atlas Replica Set or Local mongod)
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/qflow?retryWrites=true&w=majority

# Permitted Frontend Origins (comma-separated or single)
CLIENT_URL=http://localhost:5173

# Secret Key for Signing JSON Web Tokens
JWT_SECRET=your_secure_development_jwt_secret_key_minimum_32_characters

# Application Environment
NODE_ENV=development
```

---

## 4. Running the Application

### 4.1 Concurrent Development (Recommended)
Spins up both the Express backend API and the Vite React frontend server with live reload:
```bash
npm run dev
```
- **Backend API**: `http://localhost:5000`
- **Frontend App**: `http://localhost:5173`

### 4.2 Backend Only
```bash
# Production runtime
npm start

# Development runtime with Nodemon auto-restart
npm run dev:server
```

### 4.3 Frontend Only
```bash
# Vite development server with local proxy to localhost:5000
npm run dev:client

# Production client bundle build (outputs to src/client/dist)
npm run build:client
```

---

## 5. Automated Regression Testing

QFlow includes an exhaustive **14-suite, 370+ assertion master regression suite** covering Phases 03 through 15:

```bash
npm test
```

### 5.1 Deterministic In-Memory Replica Set (Zero Configuration)
When `MONGODB_URI` is **not set** in your shell (the default for clean clones and CI runners):
1. The test orchestrator (`src/server/utils/runAllValidations.js`) automatically launches an ephemeral single-node WiredTiger replica set via `mongodb-memory-server`.
2. It assigns a dynamic port and injects the ephemeral connection URI into child validation processes.
3. Multi-document transactions (`session.startTransaction()`, `session.abortTransaction()`) execute natively in RAM.
4. Upon completion or failure, the replica set is cleanly terminated.
5. **Zero cloud secrets, zero MongoDB Atlas credentials, and zero Docker containers required.** *(Note: On a fresh environment without cached binaries, mongodb-memory-server requires network access on first run to download the platform MongoDB binary).*

### 5.2 External Database Testing
To validate against a dedicated cloud or staging MongoDB Atlas instance:
```bash
# Unix / macOS / Linux Bash
MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/qflow_test" npm test

# Windows PowerShell
$env:MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/qflow_test"; npm test
```

### 5.3 Test Suite Breakdown
| Phase | Suite Name | Test Coverage |
| :--- | :--- | :--- |
| **Phase 03** | `validateAuth.js` | User authentication, bcrypt hashing, JWT issuance & verification, RBAC guards |
| **Phase 04** | `validatePhase04.js` | Clinic lifecycle, doctor profiles, active operational states |
| **Phase 05** | `validatePhase05.js` | Geospatial 2dsphere indexing, specialty filters, patient discovery |
| **Phase 06** | `validatePhase06.js` | Slot booking, concurrency collision prevention, cancellation lifecycle |
| **Phase 06S** | `validatePhase06Schema.js` | Compound partial unique index validation |
| **Phase 07** | `validatePhase07.js` | Walk-in tokens, atomic counters, **MongoDB transaction rollback integrity** |
| **Phase 08** | `validatePhase08.js` | Core HYBRID queue engine, FIFO scheduling, priority insertion, pause/resume |
| **Phase 09** | `validatePhase09.js` | Live token tracking, position countdown, dynamic wait time estimation |
| **Phase 10** | `validatePhase10.js` | Public queue display token masking, post-consultation ratings & reviews |
| **Phase 11** | `validatePhase11.js` | Patient invoicing, payment settlement, revenue aggregation |
| **Phase 12** | `validatePhase12.js` | Queue intelligence engine, ML feature extraction, delay anomaly detection |
| **Phase 13** | `validatePhase13.js` | Rate limiters, HSTS headers, secure cookies, in-app notification alerts |
| **Phase 14** | `validatePhase14.js` | Patient self-check-in, triage reclassification, doctor transfers, day-end settlement |
| **Phase 15** | `validatePhase15.js` | Governance policies, financial audit trail, streaming CSV export reports |

---

## 6. Continuous Integration (GitHub Actions)

QFlow uses GitHub Actions (`.github/workflows/ci.yml`) for automated gatekeeping on every push and pull request targeting `main`.

### Workflow Characteristics
- **Bare-Metal Linux Runner**: Runs on `ubuntu-latest` with native Node.js 24.x.
- **Strictly No Docker**: No container overhead, avoiding container daemon startup delays and Docker-in-Docker complexities.
- **Zero Secret Footprint**: Leverages `mongodb-memory-server` in RAM so no database secrets need to be provisioned in repository settings.
- **Parallel Run Cancellation**: Automatically cancels superseded runs on the same branch using `concurrency.cancel-in-progress`.

### Pipeline Stages
1. **Checkout**: Retrieves source code via `actions/checkout@v4`.
2. **Setup Node.js**: Configures Node 24.x and restores cached `~/.npm` dependencies.
3. **Clean Install**: Executes `npm ci` ensuring exact lockfile parity.
4. **Client Production Build**: Runs `npm run build:client` to verify Vite bundle compilation without warnings or errors.
5. **Master Regression Execution**: Runs `npm test` verifying all 14 suites and multi-document transactions against the in-memory replica set.

---

## 7. Cloud Deployment Runbooks

### 7.1 Backend Deployment: Render (Web Service)

Render hosts the Node.js Express API service:

1. **Create Web Service**:
   - Connect your GitHub repository to [Render](https://render.com/).
   - Select **Web Service**.
2. **Configure Service Details**:
   - **Name**: `qflow-api`
   - **Environment**: `Node`
   - **Region**: Choose the region closest to your MongoDB Atlas cluster.
   - **Branch**: `main`
   - **Root Directory**: `.`
   - **Build Command**: `npm ci`
   - **Start Command**: `npm start`
3. **Configure Health Check**:
   - **Health Check Path**: `/api/health`
4. **Configure Environment Variables**:
   ```
   PORT=5000
   NODE_ENV=production
   MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/qflow?retryWrites=true&w=majority
   CLIENT_URL=https://qflow.vercel.app,https://qflow-git-*.vercel.app
   JWT_SECRET=<strong-random-production-secret-min-32-chars>
   ```

---

### 7.2 Frontend Deployment: Vercel (Static SPA)

Vercel hosts the compiled React 19 application. QFlow provides a pre-configured `vercel.json` for automatic API reverse proxying and Single-Page Application client routing.

1. **Import Project**:
   - In [Vercel](https://vercel.com/), select **Add New Project** and import your QFlow repository.
2. **Build and Output Settings**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./` (or leave default root)
   - **Build Command**: `npm run build:client` (auto-detected via `vercel.json`)
   - **Output Directory**: `src/client/dist` (auto-detected via `vercel.json`)
3. **API Routing (`vercel.json`)**:
   ```json
   {
     "$schema": "https://openapi.vercel.sh/vercel.json",
     "buildCommand": "npm run build:client",
     "outputDirectory": "src/client/dist",
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://qflow-backend.onrender.com/api/:path*"
       },
       {
         "source": "/(.*)",
         "destination": "/index.html"
       }
     ]
   }
   ```
   *Note: Replace `https://qflow-backend.onrender.com` with your active Render web service URL.*
4. **Environment Variables (Optional)**:
   - `VITE_API_URL`: If left unset, the client defaults to `/api`, routing cleanly through Vercel's reverse proxy without CORS overhead. Set this variable only if direct client-to-Render communication is explicitly required.

---

## 8. Environment Variable Reference

| Variable | Target | Type | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `PORT` | Backend | Optional | `5000` | Port on which the Express HTTP server listens. |
| `MONGODB_URI` | Backend | **Required** (Prod/Dev) | *None* | Connection URI for MongoDB Atlas or local replica set. When absent during `npm test`, in-memory fallback is used. |
| `CLIENT_URL` | Backend | Optional | `'http://localhost:5173'` | Permitted frontend origins. Accepts comma-separated values for multiple origins (e.g. production domain and Vercel preview domains). |
| `JWT_SECRET` | Backend | **Required** (Prod/Dev) | *None* | Secret key for signing and verifying JSON Web Tokens. Auto-defaulted during CI testing. |
| `NODE_ENV` | Backend | Optional | `'development'` | Application runtime environment (`development`, `test`, `production`). In production, activates HSTS and suppresses stack traces. |
| `VITE_API_URL` | Frontend | Optional | *None* (defaults to `/api`) | Direct API URL for the frontend. When omitted, all requests route through relative `/api` path. |

---

## 9. Core Clinical Concepts & Workflow

### 9.1 Three-Stage Patient Experience
To preserve clinical focus and reduce anxiety, queue details are progressively disclosed:
1. **Discover**: Patient filters by location and specialty. Doctor cards show credentials, rating, and fee. Queue metrics remain hidden.
2. **Evaluate**: Patient examines the doctor's verified qualifications, consultation schedule, and clinic details.
3. **Commit**: Only after selecting an appointment time or requesting a queue position are live token counts, waiting windows, and recommended arrival times revealed.

### 9.2 The HYBRID Queue Engine
QFlow operates on a deterministic hybrid scheduling algorithm:
- **Scheduled Appointments**: Patients receive dedicated consultation windows based on confirmed bookings.
- **Walk-in Patients**: Triage receptionists assign walk-in tokens dynamically fitted into schedule gaps.
- **Emergency Triage**: Staff can assign elevated triage priority (`EMERGENCY`, `PRIORITY`), which recalculates estimated wait times deterministically across the queue.

### 9.3 Role-Based Access Control (RBAC)
- **Patient**: Booking, live queue tracking, notifications, post-consultation ratings, digital invoices.
- **Receptionist / Queue Operator**: Walk-in registration, appointment check-in, token calling, skipping, no-shows, doctor queue pauses, and day-end settlement.
- **Doctor**: Real-time consultation workspace, patient medical status transitions (`IN_CONSULTATION`, `COMPLETED`), daily clinical analytics.
- **Clinic Admin**: Doctor and staff provisioning, operational policy configuration, financial audit logs, and reconciliation exports.

---

## 10. License & Maintenance

Developed with precision for high-reliability healthcare operations.  
All rights reserved © QFlow Healthcare Systems.
