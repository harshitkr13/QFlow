# QFlow — Architecture

## 1. Architecture Style

QFlow uses a modular monolithic MERN architecture.

```text
React Client
    |
    | HTTP / REST
    v
Express API
    |
    +-- Authentication
    +-- Authorization
    +-- Appointment Logic
    +-- Queue Logic
    +-- Schedule Logic
    +-- Rating Logic
    |
    v
MongoDB
```

No microservices.

---

## 2. Repository Structure

```text
project/
├── README.md
├── PRD.md
├── IMPLEMENTATION_PLAN.md
├── ARCHITECTURE.md
├── DEVELOPMENT_RULES.md
├── docs/
│   ├── PHASE_01.md
│   ├── PHASE_02.md
│   └── ...
└── src/
    ├── client/
    └── server/
```

---

## 3. Backend Structure

```text
src/server/
├── config/
├── models/
├── routes/
├── controllers/
├── services/
├── middleware/
├── utils/
└── server.js
```

### Responsibility

Models:
Database schemas only.

Routes:
Map HTTP methods/paths to controllers.

Controllers:
Parse request, call service, return response.

Services:
Business logic.

Middleware:
Authentication, authorization, request validation and common error handling.

---

## 4. Frontend Structure

```text
src/client/
├── components/
├── pages/
├── layouts/
├── services/
├── context/
├── hooks/
└── styles/
```

Avoid creating a global state system unless the project actually needs one.

---

## 5. Main Domain Entities

```text
User
Clinic
Doctor
Patient
Specialty
Appointment
QueueEntry
QueueCounter
DoctorSchedule
QueueHistory
Rating
```

### Relationships

```text
Clinic
 ├── Doctors
 ├── Staff
 └── Patients

Doctor
 ├── Schedule
 ├── Appointments
 ├── QueueEntries
 └── QueueCounters

Patient
 ├── Appointments
 ├── QueueEntries
 └── Ratings

QueueEntry
 ├── Patient
 ├── Doctor
 ├── optional Appointment
 └── allocated TokenNumber

QueueCounter
 ├── Clinic
 ├── Doctor
 └── Date (stores lastTokenNumber)
```

---

## 6. Queue Model & Token Allocation Timing

An `Appointment` and a `QueueEntry` are separate concepts.

- **Appointment:** Represents a planned reservation/request for a doctor/date/time. An appointment does NOT occupy an operational queue position or hold a token.
- **QueueEntry:** Represents active operational queue participation for today's session.
- **QueueCounter:** Manages safe atomic token allocation per `{ clinicId, doctorId, date }`.

### Allocation Rules:
1. **Online Appointment:** Created in `BOOKED` state without a `QueueEntry` or token. Token is allocated ONLY when the patient physically arrives at the clinic and checks in (`CHECKED_IN`).
2. **Walk-in Patient:** Created by receptionist directly into `QueueEntry` (`WAITING`), immediately allocating an atomic token.

Important QueueEntry fields:
- clinicId
- doctorId
- patientId
- appointmentId (optional for walk-in)
- tokenNumber (allocated via QueueCounter)
- source (`ONLINE`, `WALK_IN`, `STAFF_CREATED`)
- priority
- status
- joinedAt
- calledAt
- consultationStartedAt
- completedAt

---

## 7. Queue State Machine & Lifecycle

```text
ONLINE APPOINTMENT:
  Appointment Created (BOOKED) [No Token]
         |
    Patient Arrives & Check-in
         |
  QueueEntry Created (WAITING) [Token Allocated via QueueCounter]
         |
       CALLED
         |
   IN_CONSULTATION
         |
     COMPLETED
```

```text
WALK-IN PATIENT:
  Staff Action (Add Walk-in)
         |
  QueueEntry Created (WAITING) [Token Allocated via QueueCounter]
         |
       CALLED
         |
   IN_CONSULTATION
         |
     COMPLETED
```

Alternative transitions:
```text
WAITING -> CANCELLED
WAITING -> SKIPPED
CALLED -> NO_SHOW
```

Rejoin must be an explicit staff operation that generates a new valid queue token/position.

---

## 8. Hybrid Queue Ordering Model

QFlow uses a deterministic **HYBRID** queue model combining appointment time windows and walk-in patients.

The Queue Engine calculates queue ordering based on:
- appointment target time/window
- patient check-in timestamp
- current operational time
- patients currently waiting
- doctor availability and temporary status
- scheduled doctor lunch/breaks
- average consultation duration
- configured entry priority
- existing active queue state

**Key Rule:** Once a patient is actively `WAITING` or `IN_CONSULTATION`, the queue engine MUST NOT arbitrarily reorder them merely because another patient with a later appointment time arrives or checks in. The queue ordering must remain deterministic and auditable.

---

## 9. Doctor Availability Model

Recurring schedule is separate from current operational status.

```text
Recurring Schedule
    |
    +-- Monday
    +-- Tuesday
    +-- ...
```

Operational status:
- AVAILABLE
- BUSY
- ON_BREAK
- UNAVAILABLE
- OFFLINE

This prevents a temporary event from corrupting the normal weekly schedule.

---

## 10. Patient Discovery Flow

```text
Location
   |
Specialty
   |
Doctor Search
   |
Filters / Sort
   |
Doctor Profile
   |
Proceed to Appointment
   |
Queue Information (Stage 3 Reveal)
```

Queue information must not leak into the earlier discovery stages.

---

## 11. Waiting Estimate

Initial deterministic model:

```text
estimatedWait =
  sum(expectedDuration of eligible patients ahead in hybrid queue)
  + applicable break duration
  + current remaining consultation time
```

Output:
- estimate range (e.g. 20–30 mins)
- recommended arrival time (e.g. 15 mins before estimated call time)

Never expose internal calculation as a guarantee.

---

## 12. Concurrency & QueueCounter

Critical operations must be safe against duplicate submissions and token collisions.

### QueueCounter Atomic Token Allocation:
To prevent race conditions when two receptionists add walk-in patients simultaneously or an online check-in coincides with a walk-in registration:
- Token generation uses a dedicated `QueueCounter` scoped to `{ clinicId, doctorId, date }`.
- Token increments (`$inc: { lastTokenNumber: 1 }`) MUST be performed atomically in the database (e.g. `findOneAndUpdate`).
- Simultaneous submissions safely yield strictly incremental sequential tokens (e.g. #28 and #29) with zero risk of duplicate token assignment.

Other protected concurrent operations:
- double-clicking "Call Next" or "Start Consultation" (caught via backend state verification)
- conflicting appointment slot requests (compound unique database index)

---

## 12. Polling

MVP live queue updates:

```text
React
  |
  | GET /queue/status
  | every few seconds while queue screen is active
  v
Express
  |
  v
MongoDB
```

Stop polling when the user leaves the relevant screen.

No WebSocket dependency in MVP.

---

## 13. API Conventions

Use RESTful resource naming.

Examples:

```text
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout

GET    /api/doctors
GET    /api/doctors/:id

POST   /api/appointments
GET    /api/appointments
PATCH  /api/appointments/:id/cancel

POST   /api/queue/walk-in
GET    /api/queue/:doctorId
PATCH  /api/queue/:entryId/call
PATCH  /api/queue/:entryId/start
PATCH  /api/queue/:entryId/complete
PATCH  /api/queue/:entryId/skip

PATCH  /api/doctors/:id/availability
```

Exact endpoints can evolve with the implementation.

---

## 14. Error Handling

API responses should have a consistent shape.

Example:

```json
{
  "success": false,
  "message": "Doctor is currently unavailable."
}
```

Never expose raw database errors to patients.

---

## 15. Security Boundaries

Client:
- presentation
- user interaction
- API calls

Server:
- authorization
- queue ordering
- token generation
- appointment conflict detection
- doctor availability validation
- rating eligibility
- business rules

The client must never be trusted for business-critical state.
