# Phase 08 — Core Queue Engine Architecture & Design Specification

## Executive Summary

Phase 08 implements the **Core Queue Engine** for QFlow. It governs the real-time operational lifecycle of physical queue entries (`QueueEntry`) after physical check-in or walk-in registration has occurred (Phase 07).

The Queue Engine provides:
1. **Deterministic HYBRID Queue Ordering Algorithm** combining scheduled appointment slots, arrival/check-in timestamps, walk-in traffic, and priority tiers without starving patients or arbitrarily reordering actively waiting entries.
2. **Atomic `CALL_NEXT` Execution** with database-level state claims preventing race conditions between concurrent staff operators.
3. **Operational State Machine Execution**: `START_CONSULTATION`, `COMPLETE_CONSULTATION`, `SKIP`, `NO_SHOW`, `REJOIN`, and `CANCEL`.
4. **Queue Control**: Doctor-scoped `PAUSE_QUEUE` and `RESUME_QUEUE`.
5. **Appointment ↔ QueueEntry Synchronization** ensuring strict state coherence between planned calendar reservations and physical queue participation.
6. **Append-Only `QueueHistory` Audit Logging** tracking every state transition and operator action.
7. **Staff Reception Dashboard Controls** extending the Phase 07 staff interface.

---

## 1. Architecture & Core Boundaries

### 1.1 Strict Boundary Rules
- **Phase 08 Scope:** Queue state transitions (`WAITING` -> `CALLED` -> `IN_CONSULTATION` -> `COMPLETED` / `SKIPPED` / `NO_SHOW` / `CANCELLED`), hybrid ordering engine, atomic `CALL_NEXT`, `REJOIN` handling, queue pause/resume, appointment state synchronization, append-only `QueueHistory` logging, and staff reception UI controls.
- **Phase 09+ Scope (Forbidden in Phase 08):** Patient-facing live queue tracking screens, public display monitors, predictive wait-time calculations, live WebSocket/SSE streaming (polling only per Decision 001), and patient rating submission APIs.

### 1.2 Entity Relationship Map
```
               [ Clinic ]
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
    [ Staff ]            [ Doctor ] (isQueuePaused, operationalStatus)
         │                   │
         │ (call/start/      │ (consultation status/
         │  skip/complete)   │  pause/resume)
         ▼                   ▼
[ Patient ] ────► [ QueueEntry ] ◄──── [ Appointment ]
                     │ (token)            │ (status sync)
                     ▼                    ▼
             [ QueueCounter ]     [ QueueHistory ]
```

---

## 2. Appointment vs QueueEntry State Ownership

### 2.1 State Machines
- **`Appointment` Lifecycle States:** `BOOKED` -> `CHECKED_IN` -> `COMPLETED` / `NO_SHOW` / `CANCELLED`
- **`QueueEntry` Lifecycle States:** `WAITING` -> `CALLED` -> `IN_CONSULTATION` -> `COMPLETED` / `SKIPPED` / `NO_SHOW` / `CANCELLED`

### 2.2 Synchronization Rules Matrix
| Triggering Action | `QueueEntry` Transition | Associated `Appointment` Transition | Notes |
| :--- | :--- | :--- | :--- |
| **Physical Check-In** | (Created) -> `WAITING` | `BOOKED` -> `CHECKED_IN` | Handled in Phase 07 |
| **Call Next Patient** | `WAITING` -> `CALLED` | Remains `CHECKED_IN` | Appointment reflects checked-in arrival |
| **Start Consultation** | `CALLED` -> `IN_CONSULTATION` | Remains `CHECKED_IN` | Active clinical examination |
| **Complete Consultation**| `IN_CONSULTATION` -> `COMPLETED` | `CHECKED_IN` -> `COMPLETED` | Terminal success state for both entities |
| **Skip Patient** | `CALLED` / `WAITING` -> `SKIPPED` | Remains `CHECKED_IN` | Appointment remains checked-in; patient can rejoin |
| **No-Show Patient** | `CALLED` / `WAITING` -> `NO_SHOW` | `CHECKED_IN` -> `NO_SHOW` | Terminal state for both entities |
| **Rejoin Patient** | `SKIPPED` -> `WAITING` | Remains `CHECKED_IN` | Re-inserts patient into waiting queue |
| **Cancel Entry** | `WAITING` / `CALLED` -> `CANCELLED` | `CHECKED_IN` -> `CANCELLED` | Terminal cancellation state |

---

## 3. Complete State Transition Matrix

| Current `QueueEntry` State | Action | Next `QueueEntry` State | Allowed Roles | Invalid Conditions / Guard Checks | HTTP Error on Rejection | `QueueHistory` Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `WAITING` | `CALL_NEXT` | `CALLED` | `STAFF`, `ADMIN`, `DOCTOR` | Queue paused; another patient is `CALLED` or `IN_CONSULTATION` | `400 Bad Request` | `CALL_NEXT` |
| `CALLED` | `START_CONSULTATION` | `IN_CONSULTATION` | `STAFF`, `ADMIN`, `DOCTOR` | Entry not in `CALLED` status; doctor already `IN_CONSULTATION` | `400 Bad Request` | `START_CONSULTATION` |
| `IN_CONSULTATION` | `COMPLETE` | `COMPLETED` | `STAFF`, `ADMIN`, `DOCTOR` | Entry not in `IN_CONSULTATION` status | `400 Bad Request` | `COMPLETE` |
| `CALLED` / `WAITING` | `SKIP` | `SKIPPED` | `STAFF`, `ADMIN`, `DOCTOR` | Entry already `COMPLETED`, `NO_SHOW`, or `CANCELLED` | `400 Bad Request` | `SKIP` |
| `CALLED` / `WAITING` | `NO_SHOW` | `NO_SHOW` | `STAFF`, `ADMIN`, `DOCTOR` | Entry already `COMPLETED` or `CANCELLED` | `400 Bad Request` | `NO_SHOW` |
| `SKIPPED` | `REJOIN` | `WAITING` | `STAFF`, `ADMIN`, `DOCTOR` | Entry not in `SKIPPED` status; max rejoin count exceeded | `400 Bad Request` | `REJOIN` |
| `WAITING` / `CALLED` | `CANCEL` | `CANCELLED` | `STAFF`, `ADMIN`, `DOCTOR` | Entry already `COMPLETED` | `400 Bad Request` | `CANCEL` |

---

## 4. Deterministic HYBRID Queue Ordering Algorithm

### 4.1 Core Design Principle
The HYBRID Queue Ordering algorithm combines scheduled appointment slot windows (`timeSlot.startTime`), physical arrival timestamps (`joinedAt`), walk-in registrations, and medical urgency tiers (`priority`) into a single deterministic ordering sequence. 

It guarantees:
1. **Medical Priority First:** `URGENT` priority entries always precede `NORMAL` priority entries.
2. **Slot Window Alignment:** Online appointments checked in on time are anchored to their scheduled slot time (in minutes past midnight).
3. **Arrival Fairness:** Walk-in arrivals are assigned an effective slot time equal to their check-in arrival time (in minutes past midnight).
4. **Late Arrival Penalty:** An online appointment arriving late (after slot start time) is demoted from its scheduled slot to its actual physical check-in time (`effectiveSlotTime = arrivalMinutes`), placing it behind on-time arrivals.
5. **Early Arrival Anchoring:** An online appointment arriving early retains its scheduled slot time (`effectiveSlotTime = slotStartMinutes`), preventing early arrivers from skipping ahead of earlier scheduled slots.
6. **Immutable Tie-Breaking:** When two patients have identical priority, effective slot time, and arrival minute, the lower `tokenNumber` (assigned monotonically by `QueueCounter`) serves as the strict tie-breaker.

### 4.2 Mathematical Ordering Keys
For any active `QueueEntry` in `WAITING` status on a given `{ doctorId, queueDate }`:

- `priorityWeight`: `URGENT` = 0, `NORMAL` = 1
- `effectiveSlotMinutes`: 
  - For `ONLINE` appointment with scheduled slot `T_slot` and check-in time `T_arrival`:
    - If `T_arrival <= T_slot`: `effectiveSlotMinutes = T_slot` (Minutes past midnight of slot start time)
    - If `T_arrival > T_slot`: `effectiveSlotMinutes = T_arrival` (Minutes past midnight of physical check-in time)
  - For `WALK_IN` patient with check-in time `T_arrival`:
    - `effectiveSlotMinutes = T_arrival` (Minutes past midnight of physical walk-in registration)
  - For `REJOINED` patient with rejoin time `T_rejoin`:
    - `effectiveSlotMinutes = T_rejoin` (Assigned current minute at rejoin time)
- `joinedAtTimestamp`: Exact milliseconds of `joinedAt` (or `rejoinedAt`)
- `tokenNumber`: Integer token from `QueueCounter`

### 4.3 MongoDB Sorting Specification
When selecting or listing waiting queue entries for a doctor:
```javascript
const sortCriteria = {
  priorityWeight: 1,        // Ascending (0 URGENT, 1 NORMAL)
  effectiveSlotMinutes: 1,  // Ascending (Earliest effective slot/arrival minute)
  joinedAt: 1,              // Ascending (Earliest physical check-in timestamp)
  tokenNumber: 1            // Ascending (Monotonic tie-breaker)
};
```

---

## 5. Mandatory HYBRID Ordering Test Scenarios (20 Concrete Cases)

### Scenario 1: One Walk-In Only
- **Initial Queue:** Empty.
- **New Event:** Walk-in A arrives at 09:05 AM (Token #1).
- **HYBRID Calculation:** `priorityWeight = 1`, `effectiveSlotMinutes = 545` (09:05), `tokenNumber = 1`.
- **Expected Final Queue Order:** `[Walk-In A (#1)]`
- **Reason:** Single patient in queue.

### Scenario 2: Multiple Walk-Ins Arriving Sequentially
- **Initial Queue:** `[Walk-In A (#1)]` (Arrived 09:05).
- **New Event:** Walk-In B arrives at 09:10 AM (Token #2).
- **HYBRID Calculation:** Walk-In A (`effectiveSlotMinutes = 545`, Token #1) vs Walk-In B (`effectiveSlotMinutes = 550`, Token #2).
- **Expected Final Queue Order:** `[Walk-In A (#1), Walk-In B (#2)]`
- **Reason:** Walk-In A arrived earlier.

### Scenario 3: One Online Appointment Only
- **Initial Queue:** Empty.
- **New Event:** Online Appt A (Scheduled 09:30 AM) checks in at 09:15 AM (Token #1).
- **HYBRID Calculation:** Early check-in (`09:15 < 09:30`), so `effectiveSlotMinutes = 570` (09:30).
- **Expected Final Queue Order:** `[Online Appt A (#1)]`
- **Reason:** Single checked-in appointment anchored to 09:30 AM slot.

### Scenario 4: Online Appointment Arriving After Walk-In
- **Initial Queue:** `[Walk-In A (#1)]` (Arrived 09:00 AM, `effectiveSlotMinutes = 540`).
- **New Event:** Online Appt B (Scheduled 09:15 AM) checks in at 09:05 AM (Token #2).
- **HYBRID Calculation:** Walk-In A (`effectiveSlotMinutes = 540`) vs Online Appt B (`effectiveSlotMinutes = 555`).
- **Expected Final Queue Order:** `[Walk-In A (#1), Online Appt B (#2)]`
- **Reason:** Walk-In A's arrival (09:00) precedes Online Appt B's slot (09:15).

### Scenario 5: Early Check-In for Online Appointment
- **Initial Queue:** `[Walk-In A (#1)]` (Arrived 09:20 AM, `effectiveSlotMinutes = 560`).
- **New Event:** Online Appt B (Scheduled 09:30 AM) checks in early at 09:00 AM (Token #2).
- **HYBRID Calculation:** Online Appt B's slot is 09:30 (`effectiveSlotMinutes = 570`), Walk-In A is 09:20 (`effectiveSlotMinutes = 560`).
- **Expected Final Queue Order:** `[Walk-In A (#1), Online Appt B (#2)]`
- **Reason:** Early check-in does not jump ahead of an earlier walk-in whose time (09:20) is before the scheduled slot (09:30).

### Scenario 6: On-Time Check-In for Online Appointment
- **Initial Queue:** `[Walk-In A (#1)]` (Arrived 09:35 AM, `effectiveSlotMinutes = 575`).
- **New Event:** Online Appt B (Scheduled 09:30 AM) checks in at 09:28 AM (Token #2).
- **HYBRID Calculation:** Online Appt B (`effectiveSlotMinutes = 570`), Walk-In A (`effectiveSlotMinutes = 575`).
- **Expected Final Queue Order:** `[Online Appt B (#2), Walk-In A (#1)]`
- **Reason:** Online Appt B's slot (09:30) is earlier than Walk-In A's arrival (09:35).

### Scenario 7: Late Arrival for Online Appointment
- **Initial Queue:** `[Walk-In A (#1)]` (Arrived 09:20 AM, `effectiveSlotMinutes = 560`).
- **New Event:** Online Appt B (Scheduled 09:00 AM) checks in late at 09:25 AM (Token #2).
- **HYBRID Calculation:** Late arrival (`09:25 > 09:00`), so Online Appt B is assigned `effectiveSlotMinutes = 565` (09:25).
- **Expected Final Queue Order:** `[Walk-In A (#1), Online Appt B (#2)]`
- **Reason:** Late appointment is demoted to its actual check-in minute (09:25), placing it behind Walk-In A (09:20).

### Scenario 8: Multiple Appointments with Same Scheduled Time
- **Initial Queue:** Empty.
- **New Event:** Online Appt A (10:00 AM slot) checks in at 09:45 AM (Token #1). Online Appt B (10:00 AM slot) checks in at 09:50 AM (Token #2).
- **HYBRID Calculation:** Both have `effectiveSlotMinutes = 600` (10:00). Appt A has earlier `joinedAt` (09:45) and lower Token (#1).
- **Expected Final Queue Order:** `[Online Appt A (#1), Online Appt B (#2)]`
- **Reason:** Same slot time resolved by check-in timestamp and token number tie-breaker.

### Scenario 9: Multiple Walk-Ins Arriving Close Together
- **Initial Queue:** Empty.
- **New Event:** Walk-In A arrives 10:01:10 AM (Token #1). Walk-In B arrives 10:01:40 AM (Token #2).
- **HYBRID Calculation:** Both have `effectiveSlotMinutes = 601`. Walk-In A has earlier `joinedAt` timestamp and lower Token #1.
- **Expected Final Queue Order:** `[Walk-In A (#1), Walk-In B (#2)]`
- **Reason:** Millisecond `joinedAt` and token number resolve arrivals within the same minute.

### Scenario 10: Long-Waiting Walk-In vs Newly Checked-In Appointment
- **Initial Queue:** `[Walk-In A (#1)]` (Arrived 09:00 AM, `effectiveSlotMinutes = 540`).
- **New Event:** Online Appt B (Scheduled 10:00 AM) checks in at 09:50 AM (Token #2).
- **HYBRID Calculation:** Walk-In A (`effectiveSlotMinutes = 540`), Online Appt B (`effectiveSlotMinutes = 600`).
- **Expected Final Queue Order:** `[Walk-In A (#1), Online Appt B (#2)]`
- **Reason:** Walk-In A has been waiting since 09:00 AM and is served before the 10:00 AM appointment.

### Scenario 11: Skipped Patient
- **Initial Queue:** `[Patient A (#1, WAITING), Patient B (#2, WAITING)]`.
- **New Event:** Staff calls Patient A (`CALLED`), then clicks `SKIP`.
- **HYBRID Calculation:** Patient A transitions to `SKIPPED` status and is removed from active `WAITING` queue selection.
- **Expected Final Queue Order:** Active WAITING: `[Patient B (#2)]`. SKIPPED list: `[Patient A (#1)]`.
- **Reason:** Skipped patients are excluded from `WAITING` queue queries until rejoined.

### Scenario 12: Rejoined Patient
- **Initial Queue:** Active WAITING: `[Patient B (#2)]` (Arrived 09:10 AM, `effectiveSlotMinutes = 550`). SKIPPED: `[Patient A (#1)]`.
- **New Event:** Staff clicks `REJOIN` on Patient A at 09:15 AM.
- **HYBRID Calculation:** Patient A receives `rejoinedAt = 09:15 AM`, `effectiveSlotMinutes = 555` (09:15 AM current minute).
- **Expected Final Queue Order:** Active WAITING: `[Patient B (#2), Patient A (#1)]`.
- **Reason:** Rejoined patient is re-inserted behind currently waiting Patient B (09:10) but ahead of any subsequent arrivals after 09:15 AM.

### Scenario 13: Multiple Rejoined Patients
- **Initial Queue:** SKIPPED: `[Patient A (#1), Patient B (#2)]`.
- **New Event:** Staff rejoins Patient A at 09:20 AM, then rejoins Patient B at 09:22 AM.
- **HYBRID Calculation:** Patient A (`effectiveSlotMinutes = 560`), Patient B (`effectiveSlotMinutes = 562`).
- **Expected Final Queue Order:** Active WAITING: `[Patient A (#1), Patient B (#2)]`.
- **Reason:** Rejoined patients are ordered by their respective rejoin timestamps.

### Scenario 14: Queue Paused with Waiting Patients
- **Initial Queue:** `[Patient A (#1), Patient B (#2)]`.
- **New Event:** Staff clicks `PAUSE_QUEUE`.
- **HYBRID Calculation:** `Doctor.isQueuePaused` set to `true`. Ordering calculation remains unchanged, but `CALL_NEXT` operations are rejected with `HTTP 400`.
- **Expected Final Queue Order:** Active WAITING: `[Patient A (#1), Patient B (#2)]` (Locked from calling next).
- **Reason:** Pausing locks calling next without altering queue data or order.

### Scenario 15: Queue Resumed
- **Initial Queue:** `[Patient A (#1), Patient B (#2)]` (Queue Paused).
- **New Event:** Staff clicks `RESUME_QUEUE`.
- **HYBRID Calculation:** `Doctor.isQueuePaused` set to `false`. `CALL_NEXT` is unblocked.
- **Expected Final Queue Order:** Active WAITING: `[Patient A (#1), Patient B (#2)]` (Active).
- **Reason:** Resuming unblocks operational queue processing.

### Scenario 16: Doctor Currently IN_CONSULTATION
- **Initial Queue:** `[Patient A (#1, IN_CONSULTATION), Patient B (#2, WAITING)]`.
- **New Event:** Staff attempts `CALL_NEXT`.
- **HYBRID Calculation:** System checks active patient in `CALLED` or `IN_CONSULTATION`. Patient A is currently `IN_CONSULTATION`.
- **Expected Final Queue Order:** Rejects `CALL_NEXT` with `HTTP 400 ("Doctor is currently in consultation with Patient #1")`.
- **Reason:** Only one patient can be in consultation per doctor at a time.

### Scenario 17: Appointment Checked In While Another Patient is CALLED
- **Initial Queue:** `[Patient A (#1, CALLED)]`. WAITING: `[Patient B (#2)]`.
- **New Event:** Online Appt C checks in at 09:30 AM (Token #3).
- **HYBRID Calculation:** Patient A remains `CALLED` (untouched). Online Appt C is inserted into `WAITING` queue according to hybrid ordering.
- **Expected Final Queue Order:** CALLED: `Patient A (#1)`. WAITING: `[Patient B (#2), Online Appt C (#3)]`.
- **Reason:** Newly arriving patients never displace or alter a patient who has already been `CALLED`.

### Scenario 18: Simultaneous Check-Ins (Concurrency)
- **Initial Queue:** Empty.
- **New Event:** 2 staff members check in 2 patients for the same doctor at the exact same millisecond.
- **HYBRID Calculation:** `QueueCounter` executes `$inc` outside transaction, allocating sequential Tokens #1 and #2. `joinedAt` timestamps set.
- **Expected Final Queue Order:** `[Patient 1 (#1), Patient 2 (#2)]`
- **Reason:** Atomic `QueueCounter` and token number tie-breaker guarantee deterministic, non-conflicting order.

### Scenario 19: Concurrent `CALL_NEXT` Attempts
- **Initial Queue:** `[Patient A (#1, WAITING), Patient B (#2, WAITING)]`.
- **New Event:** Staff Operator 1 and Staff Operator 2 click `CALL_NEXT` simultaneously.
- **HYBRID Calculation:** Both target top entry Patient A. Atomic `QueueEntry.findOneAndUpdate({ _id: PatientA._id, status: 'WAITING' }, { status: 'CALLED' })` accepts Operator 1's claim. Operator 2's claim fails (`status !== 'WAITING'`), returns `400 Bad Request ("Patient A is already called")`.
- **Expected Final Queue Order:** CALLED: `Patient A (#1)`. WAITING: `[Patient B (#2)]`.
- **Reason:** Atomic conditional update prevents double-calling the same patient.

### Scenario 20: Empty Queue `CALL_NEXT`
- **Initial Queue:** Empty.
- **New Event:** Staff clicks `CALL_NEXT`.
- **HYBRID Calculation:** Query returns zero waiting entries.
- **Expected Final Queue Order:** Rejects with `HTTP 404 Not Found ("No patients currently waiting in queue")`.
- **Reason:** Cannot call next when queue is empty.

---

## 6. Concurrency & Idempotency Design

### 6.1 `CALL_NEXT` Atomic Strategy
To prevent two staff members from calling the same patient simultaneously:
1. Query top candidate waiting entry for `{ doctorId, queueDate, status: 'WAITING' }` using the HYBRID sort criteria.
2. If no entry found, return `HTTP 404 ("No waiting patients")`.
3. Verify doctor has no patient currently in `CALLED` or `IN_CONSULTATION`.
4. Execute atomic state transition:
   ```javascript
   const updatedEntry = await QueueEntry.findOneAndUpdate(
     { _id: candidate._id, status: 'WAITING' },
     { status: 'CALLED', calledAt: new Date() },
     { new: true }
   );
   ```
5. If `updatedEntry` is `null` (another operator claimed it concurrently), return `HTTP 409 Conflict ("Patient status changed concurrently, please retry")`.

### 6.2 Idempotency Strategy for State Actions
All queue actions (`START`, `COMPLETE`, `SKIP`, `NO_SHOW`, `REJOIN`, `CANCEL`) enforce strict conditional state matching:
- `START_CONSULTATION`: Matches `{ _id, status: 'CALLED' }`.
- `COMPLETE_CONSULTATION`: Matches `{ _id, status: 'IN_CONSULTATION' }`.
- `SKIP`: Matches `{ _id, status: { $in: ['WAITING', 'CALLED'] } }`.
- `NO_SHOW`: Matches `{ _id, status: { $in: ['WAITING', 'CALLED'] } }`.
- `REJOIN`: Matches `{ _id, status: 'SKIPPED' }`.

If a client double-clicks or retries an API call, the state match fails on the second attempt, returning `HTTP 400 Bad Request` without duplicating writes or creating duplicate `QueueHistory` audit logs.

---

## 7. SKIP, NO_SHOW, REJOIN & PAUSE Rules

### 7.1 SKIP Rules
- **Allowed States:** `CALLED` or `WAITING`.
- **Execution:** Updates `QueueEntry.status = 'SKIPPED'`, sets `skippedAt = new Date()`.
- **Token Handling:** Token number remains assigned to the patient record and is **NEVER reused**.
- **Auto-Call Behavior:** Does **NOT** automatically call the next patient. Staff must explicitly click `CALL_NEXT`.
- **Rejoin Eligibility:** Skipped entries remain eligible for `REJOIN`.

### 7.2 NO_SHOW Rules
- **Allowed States:** `CALLED` or `WAITING`.
- **Execution:** Updates `QueueEntry.status = 'NO_SHOW'`. If linked to an online appointment, atomically updates `Appointment.status = 'NO_SHOW'`.
- **Token Handling:** Token remains consumed.
- **Terminality:** `NO_SHOW` is a terminal exception state. Rejoining a `NO_SHOW` requires explicit Staff/Admin manual override.

### 7.3 REJOIN Rules
- **Allowed States:** `SKIPPED`.
- **Execution:** Updates `QueueEntry.status = 'WAITING'`, sets `rejoinedAt = new Date()`, increments `rejoinCount`.
- **Token Allocation:** Reuses the existing `QueueEntry` record and token number. **Zero new tokens allocated from `QueueCounter`.**
- **Rejoin Limit:** Capped at a maximum of 3 rejoin attempts per patient per day (`rejoinCount <= 3`).

### 7.4 PAUSE / RESUME Rules
- **Scope:** Doctor-specific operational queue for current date (`{ doctorId, queueDate }`).
- **Storage:** Stored on `Doctor` document (`isQueuePaused: Boolean`, `queuePausedAt: Date`, `queuePauseReason: String`).
- **Behavior during Pause:**
  - Reception check-in and walk-in creation continue normally.
  - Active `IN_CONSULTATION` patient can finish consultation.
  - `CALL_NEXT` is blocked with `HTTP 400 ("Queue is currently paused")`.
- **Audit Logging:** Logs `PAUSE_QUEUE` and `RESUME_QUEUE` actions in `QueueHistory`.

---

## 8. Authorization & Role Scoping

| Endpoint / Operation | Allowed Roles | Scope Enforcement | Cross-Clinic Behavior |
| :--- | :--- | :--- | :--- |
| `GET /api/staff/queue/today` | `STAFF`, `ADMIN`, `DOCTOR` | `STAFF`: Scoped to `req.user.staffClinicId`<br/>`DOCTOR`: Scoped to own `Doctor._id` | Returns `403 Forbidden` |
| `POST /api/staff/queue/call-next` | `STAFF`, `ADMIN`, `DOCTOR` | Scoped to assigned clinic & doctor | Returns `403 Forbidden` |
| `PATCH /api/staff/queue/:id/start` | `STAFF`, `ADMIN`, `DOCTOR` | Scoped to assigned clinic & doctor | Returns `403 Forbidden` |
| `PATCH /api/staff/queue/:id/complete` | `STAFF`, `ADMIN`, `DOCTOR` | Scoped to assigned clinic & doctor | Returns `403 Forbidden` |
| `PATCH /api/staff/queue/:id/skip` | `STAFF`, `ADMIN`, `DOCTOR` | Scoped to assigned clinic & doctor | Returns `403 Forbidden` |
| `PATCH /api/staff/queue/:id/no-show` | `STAFF`, `ADMIN`, `DOCTOR` | Scoped to assigned clinic & doctor | Returns `403 Forbidden` |
| `POST /api/staff/queue/:id/rejoin` | `STAFF`, `ADMIN`, `DOCTOR` | Scoped to assigned clinic & doctor | Returns `403 Forbidden` |
| `PATCH /api/staff/queue/pause` | `STAFF`, `ADMIN`, `DOCTOR` | Scoped to assigned clinic & doctor | Returns `403 Forbidden` |
| `PATCH /api/staff/queue/resume` | `STAFF`, `ADMIN`, `DOCTOR` | Scoped to assigned clinic & doctor | Returns `403 Forbidden` |

*Note: `PATIENT` role is forbidden from accessing all staff queue engine endpoints (`HTTP 403 Forbidden`).*

---

## 9. Schema & Index Amendments Required

### 9.1 `QueueEntry` Schema Amendments
Add the following fields to `src/server/models/QueueEntry.js`:
```javascript
effectiveSlotMinutes: {
  type: Number, // Minutes past midnight (0-1439) for HYBRID ordering
  required: true,
},
priorityWeight: {
  type: Number, // 0 for URGENT, 1 for NORMAL
  default: 1,
},
skippedAt: {
  type: Date,
  default: null,
},
rejoinedAt: {
  type: Date,
  default: null,
},
rejoinCount: {
  type: Number,
  default: 0,
},
```

### 9.2 `Doctor` Schema Amendments
Add the following fields to `src/server/models/Doctor.js`:
```javascript
isQueuePaused: {
  type: Boolean,
  default: false,
},
queuePausedAt: {
  type: Date,
  default: null,
},
queuePauseReason: {
  type: String,
  default: null,
},
```

### 9.3 MongoDB Index Additions
Add the compound index to `src/server/models/QueueEntry.js` for instant O(1) hybrid ordering queries:
```javascript
queueEntrySchema.index(
  { doctorId: 1, queueDate: 1, status: 1, priorityWeight: 1, effectiveSlotMinutes: 1, joinedAt: 1, tokenNumber: 1 },
  { name: 'hybrid_queue_ordering_idx' }
);
```

---

## 10. API Contracts

### 1. Call Next Patient
- **Route:** `POST /api/staff/queue/call-next`
- **Auth:** `protect, authorize('STAFF', 'ADMIN', 'DOCTOR')`
- **Request Body:** `{ "doctorId": "60d5ecb74b1234567890ef01" }`
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Patient called successfully",
    "queueEntry": {
      "_id": "60d5ecb74b12345678909999",
      "tokenNumber": 5,
      "status": "CALLED",
      "calledAt": "2026-08-14T01:10:00.000Z",
      "patientName": "John Doe",
      "source": "ONLINE"
    }
  }
  ```

### 2. Start Consultation
- **Route:** `PATCH /api/staff/queue/:id/start`
- **Auth:** `protect, authorize('STAFF', 'ADMIN', 'DOCTOR')`
- **Success Response (`200 OK`):** Returns updated `QueueEntry` (`status: "IN_CONSULTATION"`).

### 3. Complete Consultation
- **Route:** `PATCH /api/staff/queue/:id/complete`
- **Auth:** `protect, authorize('STAFF', 'ADMIN', 'DOCTOR')`
- **Success Response (`200 OK`):** Returns updated `QueueEntry` (`status: "COMPLETED"`) and syncs `Appointment` status (`COMPLETED`).

### 4. Skip Patient
- **Route:** `PATCH /api/staff/queue/:id/skip`
- **Auth:** `protect, authorize('STAFF', 'ADMIN', 'DOCTOR')`
- **Success Response (`200 OK`):** Returns updated `QueueEntry` (`status: "SKIPPED"`).

### 5. Mark No-Show
- **Route:** `PATCH /api/staff/queue/:id/no-show`
- **Auth:** `protect, authorize('STAFF', 'ADMIN', 'DOCTOR')`
- **Success Response (`200 OK`):** Returns updated `QueueEntry` (`status: "NO_SHOW"`) and syncs `Appointment` status (`NO_SHOW`).

### 6. Rejoin Skipped Patient
- **Route:** `POST /api/staff/queue/:id/rejoin`
- **Auth:** `protect, authorize('STAFF', 'ADMIN', 'DOCTOR')`
- **Success Response (`200 OK`):** Returns updated `QueueEntry` (`status: "WAITING"`).

### 7. Pause Queue
- **Route:** `PATCH /api/staff/queue/pause`
- **Auth:** `protect, authorize('STAFF', 'ADMIN', 'DOCTOR')`
- **Request Body:** `{ "doctorId": "...", "reason": "Emergency procedure" }`
- **Success Response (`200 OK`):** Returns `{ "success": true, "isQueuePaused": true }`.

### 8. Resume Queue
- **Route:** `PATCH /api/staff/queue/resume`
- **Auth:** `protect, authorize('STAFF', 'ADMIN', 'DOCTOR')`
- **Request Body:** `{ "doctorId": "..." }`
- **Success Response (`200 OK`):** Returns `{ "success": true, "isQueuePaused": false }`.

---

## 11. Test Plan Specification

### 11.1 Functional Validation Tests
- Verify `CALL_NEXT` picks the highest priority / earliest effective slot patient according to HYBRID rules.
- Verify `START_CONSULTATION` transitions status to `IN_CONSULTATION`.
- Verify `COMPLETE_CONSULTATION` transitions `QueueEntry` and `Appointment` to `COMPLETED`.
- Verify `SKIP` transitions entry to `SKIPPED` without deleting record or allocating new token.
- Verify `NO_SHOW` transitions `QueueEntry` and `Appointment` to `NO_SHOW`.
- Verify `REJOIN` restores `SKIPPED` entry to `WAITING` with original token number.
- Verify `PAUSE_QUEUE` blocks `CALL_NEXT` with `400 Bad Request`.
- Verify `RESUME_QUEUE` unblocks `CALL_NEXT`.

### 11.2 Concurrency & Stress Tests (`Promise.all`)
- **Simultaneous `CALL_NEXT`:** Fire 2 parallel `CALL_NEXT` calls $\rightarrow$ Exactly 1 succeeds, 1 receives error/conflict; exactly 1 patient called.
- **Simultaneous `START`:** Fire 2 parallel `START` calls on same entry $\rightarrow$ Exactly 1 succeeds (200), 1 fails (400).
- **Simultaneous `COMPLETE`:** Fire 2 parallel `COMPLETE` calls $\rightarrow$ Exactly 1 succeeds (200), 1 fails (400).
- **Simultaneous `REJOIN`:** Fire 2 parallel `REJOIN` calls $\rightarrow$ Exactly 1 succeeds (200), 1 fails (400).

### 11.3 Security & IDOR Tests
- Patient role attempts to invoke `CALL_NEXT` $\rightarrow$ Rejected `403 Forbidden`.
- Staff from Clinic A attempts to invoke queue actions on Doctor in Clinic B $\rightarrow$ Rejected `403 Forbidden`.

### 11.4 Regression Verification
- Run complete test suite: Phase 03 (23/23), Phase 04 (44/44), Phase 05 (58/58), Phase 06 (48/48), Phase 07, Health check, and Client build.

---

## 12. Open Questions & Resolution Status

- **Open Question 1:** Should doctors be allowed to call next directly from their own dashboard?
  - *Resolution:* Yes, Doctors and Staff share the operational queue actions for assigned clinics, but primary operator responsibility remains with Staff per Decision 006.
- **Open Question 2:** Does `SKIP` automatically call the next patient?
  - *Resolution:* No. Auto-calling creates confusion if staff need to prepare the room. `CALL_NEXT` must be explicitly triggered.

---

## 13. Final Readiness Verdict

### **READY FOR IMPLEMENTATION**
