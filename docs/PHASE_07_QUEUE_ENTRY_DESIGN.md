# Phase 07 — Walk-In Registration & Online Check-In Specification (Reconciled & Locked)

## Executive Summary

Phase 07 establishes the operational foundation for the QFlow queue management engine. It connects physical clinic arrival (both online appointments and walk-in arrivals) to live operational queue entries (`QueueEntry`) and provides atomic queue token allocation (`QueueCounter`).

This document defines the complete architectural design, atomic concurrency primitives, data payload contracts, failure modes, locked business decisions, and test suite specifications for Phase 07.

---

## 1. Architecture & Core Boundaries

### 1.1 Strict Boundary Rules
- **Phase 07 Scope:** Staff/Admin walk-in registration, patient search & creation, online appointment check-in, `QueueEntry` creation, atomic `QueueCounter` token allocation, `QueueHistory` audit logging, and clinic-scoped RBAC authorization.
- **Phase 08 Boundary (Hybrid Queue Engine):** Phase 07 DOES NOT implement `CALL_NEXT`, `SKIP`, `NO_SHOW`, queue ordering algorithms, estimated wait times, live queue dashboards, or patient-facing queue metrics.

### 1.2 Entity Relationship Map
```
               [ Clinic ]
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
    [ Staff ]            [ Doctor ]
         │                   │
         │ (check-in /       │
         │  walk-in)         │
         ▼                   ▼
[ Patient ] ────► [ QueueEntry ] ◄──── [ Appointment ]
                     │ (token)
                     ▼
             [ QueueCounter ]
                     │ (audit)
                     ▼
             [ QueueHistory ]
```

---

## 2. Locked Business & Design Decisions

### DECISION 001 — Check-In Timing Policy
- **Date Verification:** Check-in is permitted **ONLY on the scheduled `appointmentDate`** evaluated in clinic local date (`Asia/Kolkata`, `YYYY-MM-DD`). Check-in before or after the scheduled date returns HTTP 400 (`Check-in is only permitted on the scheduled appointment date`).
- **Earliest Window:** Staff/Admin may check in an appointment up to **60 minutes prior** to `timeSlot.startTime` on the scheduled date. Check-in attempted earlier than 60 minutes returns HTTP 400 (`Check-in window opens 60 minutes before appointment start time`).
- **Grace Window:** Check-in is permitted up to **60 minutes after** `timeSlot.startTime` on the scheduled date.
- **Expired Check-In:** Check-in attempted more than 60 minutes after slot start time returns HTTP 400 (`Check-in period has expired for this appointment`).

### DECISION 002 — Transaction & Token Semantics (Option B Locked)
- **Token Allocation Primitive:** `QueueCounter` uses atomic `$inc: { lastTokenNumber: 1 }` **OUTSIDE** the multi-document transaction.
- **Rationale:** Executing `QueueCounter` increment inside MongoDB multi-document transactions causes severe `WriteConflict` transaction aborts under high receptionist concurrency. Atomic `$inc` outside the transaction guarantees instant, non-blocking counter increments.
- **Token Gap Policy:** If a subsequent `QueueEntry` creation fails, the incremented token remains consumed. Token gaps (e.g. Tokens 1, 2, 4...) are 100% accepted in real-world queue domain operations (standard physical token dispenser behavior). Token numbers are never reused.

### DECISION 003 — Admin & Staff Operational RBAC
- **ADMIN:** Authorized to perform patient search, patient creation, walk-in registration, and online appointment check-in **across all clinics** (global operational privilege).
- **STAFF:** Authorized to perform operations **ONLY within their assigned clinic** (`Staff.clinicId`). Cross-clinic attempts return HTTP 403 Forbidden.
- **PATIENT & DOCTOR:** Prohibited from performing staff queue operations (HTTP 403 Forbidden).

### DECISION 004 — Account Linking Boundary
- Phase 07 creates domain `Patient` profiles required for operational queue participation with `userId = null`.
- Phase 07 DOES NOT implement online account claiming, profile merging, or credential linking. Account claiming is out of scope for Phase 07.

---

## 3. Walk-In Registration Flow

### 3.1 Workflow Diagram
```
Staff / Admin logs in (JWT)
  │
  ├─► Search Patient by Phone / Name (POST /api/staff/patients/search)
  │     ├── Patient Found ──► Select Existing Patient
  │     └── Patient Not Found ──► Create Patient Profile (POST /api/staff/patients)
  │
  └─► Select Assigned Doctor in Clinic
        │
        └─► Register Walk-In (POST /api/staff/queue/walk-in)
              │
              ├── 1. Validate Staff/Admin Clinic Authorization & Active Doctor
              ├── 2. Verify Duplicate Active Queue Entry (409 if already in active queue)
              ├── 3. Atomic QueueCounter Increment ($inc lastTokenNumber) -> tokenNumber
              ├── 4. Create QueueEntry (source: 'WALK_IN', status: 'WAITING')
              └── 5. Append QueueHistory (action: 'CHECK_IN')
```

### 3.2 Walk-In Payload Contract
```json
{
  "clinicId": "60d5ecb74b1234567890abcd",
  "doctorId": "60d5ecb74b1234567890ef01",
  "patientId": "60d5ecb74b12345678901234",
  "appointmentId": null,
  "queueDate": "2026-08-12",
  "tokenNumber": 14,
  "source": "WALK_IN",
  "priority": "NORMAL",
  "status": "WAITING",
  "joinedAt": "2026-08-12T01:50:00.000Z"
}
```

---

## 4. Concurrent Check-In & Race Condition Protection

### 4.1 Concurrent Check-In Mechanism
When Staff A and Staff B simultaneously check in `Appointment X`:
1. Both requests attempt atomic state transition:
   ```javascript
   const appt = await Appointment.findOneAndUpdate(
     { _id: appointmentId, status: 'BOOKED' },
     { status: 'CHECKED_IN', checkedInAt: new Date() },
     { new: true }
   );
   ```
2. **Result:** Exactly **ONE** atomic request finds `status: 'BOOKED'` and transitions to `'CHECKED_IN'`.
3. The losing request receives `null` (since status is now `'CHECKED_IN'`) and returns HTTP 400 Bad Request (`Appointment is already checked in`).
4. **Guarantees:** ONE appointment $\rightarrow$ ONE `CHECKED_IN` status $\rightarrow$ ONE `QueueEntry` $\rightarrow$ ONE `tokenNumber`.

---

## 5. Timezone Strategy

- **Operational Queue Date (`queueDate`):** Derived using `Asia/Kolkata` (IST) date formatter (`YYYY-MM-DD`).
- **Server Evaluation:** Evaluated dynamically using `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })`.
- Node.js server system timezone (UTC/PST) is ignored to prevent midnight rollover bugs.

---

## 6. Schema Amendments Required

### Required Schema Amendments (To be applied in Phase 07 Implementation Task):
1. **`Patient.js` Unique Phone Constraint:**
   - Convert `Patient.phone` index to `unique: true` to prevent duplicate patient profiles created under concurrent receptionist registration.
2. **`QueueEntry.js` Duplicate Active Queue Constraint:**
   - Add partial unique index to prevent duplicate active entries for the same patient/doctor/date:
     ```javascript
     queueEntrySchema.index(
       { doctorId: 1, patientId: 1, queueDate: 1 },
       {
         unique: true,
         partialFilterExpression: { status: { $in: ['WAITING', 'CALLED', 'IN_CONSULTATION'] } },
         name: 'unique_active_patient_queue_idx',
       }
     );
     ```
3. **`QueueEntry.js` Appointment Uniqueness:**
   - Add partial unique index on `appointmentId`:
     ```javascript
     queueEntrySchema.index(
       { appointmentId: 1 },
       {
         unique: true,
         partialFilterExpression: { appointmentId: { $type: 'objectId' } },
         name: 'unique_appointment_queue_entry_idx',
       }
     );
     ```

---

## 7. Failure Modes & HTTP Responses

| Scenario | HTTP Status | Response Message |
| :--- | :--- | :--- |
| **Check-in before 60m window** | `400 Bad Request` | `"Check-in window opens 60 minutes before appointment start time"` |
| **Check-in after 60m slot expiry** | `400 Bad Request` | `"Check-in period has expired for this appointment"` |
| **Duplicate Check-in attempt** | `400 Bad Request` | `"Appointment is already checked in"` |
| **Cross-clinic staff action** | `403 Forbidden` | `"Staff is not authorized for this clinic"` |
| **Cancelled appointment check-in** | `400 Bad Request` | `"Cannot check in cancelled appointment"` |
| **Duplicate Walk-In registration** | `409 Conflict` | `"Patient already has an active queue entry for this doctor today"` |

---

## 8. API Specifications

1. `POST /api/staff/patients/search` — Search existing patients by phone/name.
2. `POST /api/staff/patients` — Create new walk-in patient profile (`userId = null`).
3. `POST /api/staff/queue/walk-in` — Register walk-in arrival, allocate token, create `QueueEntry`.
4. `PATCH /api/appointments/:id/check-in` — Perform online appointment check-in, allocate token, create `QueueEntry`.
5. `GET /api/staff/queue/today` — Read today's operational queue list for staff/admin clinic.

---

## 9. Test Specification (`validatePhase07.js`)

The Phase 07 validation runner will assert:
1. Staff patient search by phone & name.
2. Staff creation of walk-in patient without user credentials (`userId = null`).
3. Duplicate patient phone registration rejected by unique index (HTTP 409).
4. Walk-in registration allocates Token `#1` and creates `QueueEntry` (`WAITING`).
5. Online appointment check-in within 60-min window updates `Appointment` to `CHECKED_IN` and allocates Token `#2`.
6. Early (<60m) and expired (>60m) check-in attempts rejected (HTTP 400).
7. Concurrent `Promise.all` token allocations yield sequential unique tokens.
8. Concurrent check-ins on same appointment yield exactly 1 `QueueEntry` and 1 Token; second request fails with HTTP 400.
9. Cross-clinic staff action rejected (HTTP 403); Admin cross-clinic action allowed (HTTP 200).
10. Full regression suites (Phase 03, Phase 04, Phase 05, Phase 06, Health check, Client build) pass 100%.

---

## Final Status

### **READY FOR IMPLEMENTATION**
