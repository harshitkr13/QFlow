# QFlow — Implementation Plan

## Development Strategy

Implement in dependency order. Do not build all UI first.

### Phase 01 — Project Foundation
- repository structure
- React app
- Express server
- MongoDB connection
- environment configuration
- basic error handling
- health endpoint

Deliverable:
Frontend and backend communicate successfully.

### Phase 02 — Data Models
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

Deliverable:
Stable schema and relationships.

### Phase 03 — Authentication & Authorization
- registration
- login
- logout
- secure session
- auth middleware
- role middleware
- protected routes

Deliverable:
Patient, staff, doctor and admin can access only permitted areas.

### Phase 04 — Clinic, Doctor & Schedule Management
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

### Phase 05 — Patient Discovery
- location selection
- specialty selection
- doctor list
- distance calculation
- rating/experience filters
- sorting
- doctor profile
- clean discovery UX

Important:
Do not expose queue counts on discovery cards.

### Phase 06 — Appointment Flow
- choose doctor
- choose date/time slot
- validate availability
- create appointment (`BOOKED` state, no token allocated)
- cancellation
- clinic check-in (creates `QueueEntry`, allocates token via `QueueCounter`)

Deliverable:
Complete online appointment and check-in path.

### Phase 07 — Walk-in Flow
- receptionist patient search/create
- walk-in registration
- atomic token generation via `QueueCounter`
- duplicate token protection
- queue entry creation (`WALK_IN` source)

Deliverable:
Offline-originating patients become digital queue entries safely.

### Phase 08 — Queue Engine
Implement state transitions:
- `BOOKED` (Appointment created)
- `CHECKED_IN` / `WAITING` (QueueEntry + Token allocated)
- `CALLED`
- `IN_CONSULTATION`
- `COMPLETED`
- `SKIPPED`
- `NO_SHOW`
- `CANCELLED`

Implement:
- deterministic HYBRID queue ordering algorithm
- call next
- skip
- complete
- queue pause/resume
- atomic token generation via QueueCounter

Deliverable:
Core operational hybrid queue engine works.

### Phase 09 — Doctor & Staff Dashboards
Staff:
- queue overview
- add walk-in
- call next
- skip
- pause/resume
- doctor availability

Doctor:
- current patient
- next patient
- start/complete consultation

Deliverable:
Clinic can operate without patients managing the queue themselves.

### Phase 10 — Patient Queue Tracking
- token screen
- current token
- waiting count
- estimated wait
- expected consultation window
- recommended arrival
- polling-based refresh

Deliverable:
Patient can leave the physical queue area and track progress.

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
