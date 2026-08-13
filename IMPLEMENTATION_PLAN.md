# QFlow — Implementation Plan

## Development Strategy

Implement in dependency order. Do not build all UI first.

### Phase 01 — Project Foundation (COMPLETE)
- repository structure
- React app
- Express server
- MongoDB connection
- environment configuration
- basic error handling
- health endpoint

Deliverable:
Frontend and backend communicate successfully.

### Phase 02 — Data Models (COMPLETE)
Create and validate:
- User
- Clinic
- Doctor
- Patient
- Service/Specialty
- Appointment
- QueueEntry
- QueueCounter (atomic token counter per clinic/doctor/date)
- DoctorSchedule
- QueueHistory
- Rating
- Staff (Phase 02 Amendment)

Deliverable:
Stable schema and relationships.

### Phase 03 — Authentication & Authorization (COMPLETE)
- registration
- login
- logout
- secure session
- auth middleware
- role middleware
- protected routes

Deliverable:
Patient, staff, doctor and admin can access only permitted areas.

### Phase 04 — Clinic, Doctor & Schedule Management (COMPLETE)
- clinic profile
- doctor profile
- qualifications
- specialization
- fee
- recurring schedule
- weekly availability
- breaks
- temporary status

Deliverable:
Admin can configure operational doctor data.

### Phase 05 — Patient Discovery (COMPLETE)
- location selection
- specialty selection
- doctor list
- distance calculation
- rating/experience filters
- sorting
- doctor profile
- clean discovery UX

Deliverable:
Stage 1 & Stage 2 patient discovery with operational blindness.

### Phase 06 — Appointment Booking & Scheduling (COMPLETE)
- choose doctor
- choose date/time slot
- validate availability
- create appointment (`BOOKED` state, no token allocated)
- cancellation
- clinic check-in boundary (transitions status to `CHECKED_IN`)
- Detailed Specification: `docs/PHASE_06_APPOINTMENT_DESIGN.md`

Deliverable:
Complete online appointment booking and scheduling system.

### Phase 07 — Walk-in Registration & Check-In Entry (COMPLETE)
- receptionist patient search/create
- walk-in registration
- atomic token generation via `QueueCounter`
- duplicate token protection
- queue entry creation (`WALK_IN` and `ONLINE` sources)
- Detailed Specification: `docs/PHASE_07_QUEUE_ENTRY_DESIGN.md`

Deliverable:
Operational queue entry registration and token allocation completed and committed.

### Phase 08 — Queue Engine (COMPLETE)
Implemented state transitions & core engine:
- `BOOKED` (Appointment created)
- `CHECKED_IN` / `WAITING` (QueueEntry + Token allocated)
- `CALLED`
- `IN_CONSULTATION`
- `COMPLETED`
- `SKIPPED`
- `NO_SHOW`
- `CANCELLED`

Implemented:
- deterministic HYBRID queue ordering algorithm
- atomic call next with conditional claim
- start consultation
- complete consultation
- skip patient
- no-show patient
- rejoin skipped patient with new token allocation
- date-scoped doctor queue pause/resume
- compound index `hybrid_queue_ordering_idx`
- append-only `QueueHistory` audit logging
- staff reception desk UI integration
- Detailed Specification: `docs/PHASE_08_QUEUE_ENGINE_DESIGN.md`

Deliverable:
Core operational hybrid queue engine completed, audited, tested (100% pass across 20 scenarios & regression), and committed (`f24ce81`).

### Phase 09 — Patient Live Queue Experience (COMPLETE)
Implemented patient-facing live queue tracking:
- patient-safe live queue snapshot (`GET /api/patient/queue/live`)
- server-authoritative HYBRID queue position calculation
- current serving token & serving state (`CALLED` / `IN_CONSULTATION` / `IDLE`)
- privacy boundary enforcement (zero data leakage of other patients)
- deterministic wait-time estimation based on `averageConsultationDurationMinutes`
- resilient 10-second polling transport with background tab throttling
- React Patient Live Queue UI component & integration
- Detailed Specification: `docs/PHASE_09_LIVE_QUEUE_DESIGN.md`

Deliverable:
Patient live queue tracking completed, audited, tested (100% pass across 8 core tests & regression), and committed (`3760414`).

### Phase 10 — Public Queue Display, Verified Ratings & Notifications (DESIGN SPECIFIED)
Design & implement public display, ratings & notifications:
- public clinic queue display board (`GET /api/public/queue/display`)
- verified patient ratings & doctor reviews (`POST /api/patient/ratings`)
- atomic doctor rating recalculation
- database-backed in-app queue notifications (`Notification` model)
- React Public Display, Rating Modal & Notification Bell components
- Detailed Specification: `docs/PHASE_10_DESIGN.md`

Deliverable:
Anonymous public display board, verified ratings system, and in-app notifications design specified.

### Phase 11 — Ratings, History & Analytics
- verified rating
- consultation history
- queue history
- daily statistics
- online/walk-in analytics
- waiting/consultation averages

Deliverable:
Operational reporting.

### Phase 12 — Validation, Security & Production Hardening
- server validation
- authorization review
- edge cases
- duplicate submission protection
- token collision tests
- appointment conflicts
- break conflicts
- no-show behavior
- production build
- deployment

Deliverable:
Portfolio-ready release.

---

## Suggested MVP Cut

If time is limited, finish Phase 01–10 first.

Phase 11–12 can follow.

## Definition of Done per Phase

A phase is not complete because the UI exists.

A phase is complete when:
1. backend behavior works;
2. invalid states are rejected;
3. role permissions are enforced;
4. frontend handles success/error/loading;
5. data survives refresh;
6. the phase's acceptance scenario passes.
