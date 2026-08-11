# QFlow Project Audit

## 1. Project Understanding

QFlow is a MERN-based Virtual Queue and Appointment Management Platform built for clinics and healthcare providers. 

The core philosophy of QFlow is:
> **"Don't just book an appointment. Know when you actually need to reach the clinic."**

Rather than acting as a medical diagnosis system or a basic booking calendar, QFlow resolves clinic congestion and patient anxiety by unifying two distinct entry channels—**online pre-booked appointments** and **physical walk-in registrations**—into a single, deterministic operational queue. 

Key pillars of the platform:
1. **Multi-Stage Patient Experience:** Strict separation between doctor discovery (Stage 1), profile evaluation (Stage 2), and active queue/appointment decision making (Stage 3). Operational queue counts and waiting metrics are hidden until Stage 3.
2. **Staff-Centric Operational Control:** The Receptionist / Compounder serves as the primary queue operator (calling, skipping, checking in, pausing, managing walk-ins, and handling temporary doctor unavailability), freeing doctors to focus exclusively on patient consultations.
3. **Decoupled Doctor Availability:** Decoupling recurring weekly schedules (e.g., Mon–Fri 9:00 AM – 1:00 PM) from live operational statuses (`AVAILABLE`, `BUSY`, `ON_BREAK`, `UNAVAILABLE`, `OFFLINE`). Temporary breaks or delays update estimates without altering the weekly template.
4. **Deterministic Waiting & Arrival Window Calculation:** Using mathematical algorithms (not AI) based on queue position, remaining consultation time, historical/service duration averages, and planned breaks to calculate an estimated waiting range (e.g., 35–45 mins) and a recommended arrival time (e.g., 15 mins prior).
5. **Robust Concurrency & State Machine:** Protecting queue state and token allocation at the database level against simultaneous staff actions, double bookings, or duplicate submissions.

---

## 2. Confirmed Product Decisions

All fundamental architectural and product decisions are locked as follows:

1. **Technology Stack:**
   - **Frontend:** React, JavaScript, Vanilla CSS.
   - **Backend:** Node.js, Express.js.
   - **Database:** MongoDB, Mongoose.
   - **Real-time Strategy:** HTTP Polling from React to Express API (WebSockets, Socket.io, Server-Sent Events are explicitly excluded for MVP).
   - **Authentication:** Server-managed session/cookie-based authentication.
   - **Excluded Tech:** No AI/ML, Next.js, TypeScript, Tailwind, Redux, Material UI, Redis, Kafka, or microservices.

2. **3-Stage Patient UX Rule:**
   - **Stage 1 (Discovery List):** Shows only doctor photo, name, specialty, qualification, experience, rating, distance, consultation fee, and broad availability (`Available Today` / `Next Available Mon`). **NO** queue metrics (waiting count, serving token, online/walk-in ratio, estimated wait time).
   - **Stage 2 (Doctor Profile):** Detailed qualification, experience, clinic address, fee breakdown, weekly schedule, and break schedule. **NO** live queue metrics.
   - **Stage 3 (Appointment / Queue Decision):** Revealed ONLY when patient clicks to book or join queue. Shows live operational status, currently serving token, currently waiting count, online vs. walk-in composition, wait time range, expected consultation window, and recommended arrival time.

3. **Unified Queue Model:**
   - Both online appointment holders and walk-in patients end up in the exact same operational queue per doctor per day/session.
   - Entry sources are tagged as `ONLINE`, `WALK_IN`, or `STAFF_CREATED`.
   - Walk-in patients do not require online accounts or pre-booking to be added to the queue by clinic staff.

4. **Staff as Primary Operator:**
   - Receptionist/Compounder executes routine operations (`Call Next`, `Add Walk-in`, `Skip`, `No-Show`, `Pause Queue`, `Set Expected Resume Time`).
   - Doctor views current patient, next patient, and marks consultation `Started` or `Completed`.

5. **Schedule vs. Operational Status Separation:**
   - Weekly template (e.g., Mon 9-1, 2-6) is stored separately from daily operational status overrides (`AVAILABLE`, `BUSY`, `ON_BREAK`, `UNAVAILABLE`, `OFFLINE`).

6. **Deterministic Wait Time Range:**
   - Wait times are calculated as ranges (e.g., 20–30 minutes) using mathematical logic including queue length, remaining duration, break times, and average consultation times. Estimates are presented as advisory, not guaranteed.

7. **Backend-Driven Queue Authority & Concurrency Safety:**
   - Queue state machine transitions and token generation are strictly controlled and validated server-side using atomic database operations.

8. **Medical Neutrality & Specialty Rules:**
   - No diagnostic logic or emergency triage. Doctor gender is purely an optional patient search filter, and specialty selection is category lookup.

---

## 3. User Roles

| Role | Primary Responsibilities | Key Access Permissions |
| :--- | :--- | :--- |
| **PATIENT** | Browse doctors by location/specialty; evaluate doctor profiles; book online appointments; join queue; track live token & wait time; cancel own bookings; submit post-consultation ratings. | Patient discovery, profile, own appointments, own token tracking, ratings endpoints. |
| **DOCTOR** | View personal daily patient queue; view current and upcoming patient details; mark consultation start and completion; view personal schedule and status. | Doctor dashboard, consultation status endpoints for assigned patients. |
| **RECEPTIONIST / STAFF** | Primary queue operator: search/register walk-in patients; check in arriving online patients; call next patient; skip/no-show patients; rejoin skipped patients; set doctor status (`BUSY`, `ON_BREAK`, `UNAVAILABLE`); set expected resume time; pause/resume queue. | Operational queue control, patient walk-in registration, doctor availability toggle endpoints. |
| **CLINIC ADMIN** | Manage clinic profile, add/manage doctors and staff members, configure recurring doctor schedules and breaks, set clinic queue policies, access clinic-wide analytics and audit logs. | Administrative configuration, staff management, schedule creation, analytics reporting. |

---

## 4. Core Workflows

### 4.1 Patient Discovery Workflow
1. Patient sets location (manual input or browser geolocation) and selects a medical specialty.
2. System queries active doctors matching the criteria and calculates distance using coordinate math.
3. Doctor list displays cards containing discovery information only (Name, Photo, Specialty, Rating, Experience, Distance, Fee, Broad Availability).
4. Queue metrics (waiting count, serving token, estimated wait time) are strictly suppressed.

### 4.2 Doctor Profile Workflow
1. Patient clicks "View Profile" on a doctor card.
2. Profile displays full qualification history, experience summary, clinic address, map location, consultation fee, weekly working hours, break schedules, and reviews.
3. Live operational queue metrics remain suppressed.

### 4.3 Appointment & Queue Decision Workflow (Stage 3 Reveal)
1. Patient clicks "Book Appointment" or "Join Queue".
2. System loads and reveals live operational queue metrics for the doctor: Currently Serving Token, Currently Waiting Count, Online/Walk-in composition, Estimated Wait Time Range, Expected Consultation Window, and Recommended Arrival Time.
3. Patient selects slot/queue entry and confirms booking.
4. Server validates availability, generates token/booking record, and returns confirmation.

### 4.4 Online Queue Entry Workflow
1. Patient arrives at clinic or checks in online within allowed arrival window.
2. Staff or system marks appointment status as `CHECKED_IN`, transitioning entry to `WAITING` state in the active queue.
3. Patient tracks token progression and updated wait estimates via HTTP polling on their device.

### 4.5 Walk-in Queue Entry Workflow
1. Walk-in patient arrives physically at the clinic reception.
2. Receptionist searches existing patient records by phone number or creates a quick patient profile.
3. Receptionist selects doctor and service, and clicks "Add Walk-in".
4. Server atomically allocates the next sequential token (e.g., Token #35) and inserts `QueueEntry` with source `WALK_IN` into `WAITING` state.
5. Patient receives physical or SMS/printed token ticket.

### 4.6 Staff Queue Management Workflow
1. Receptionist monitors live queue table (Online vs. Walk-in list).
2. Click "Call Next": System transitions top `WAITING` entry to `CALLED`.
3. If patient enters room: Status transitions to `IN_CONSULTATION`.
4. If patient is absent: Staff clicks "Skip" (`SKIPPED`) or "No-Show" (`NO_SHOW`).
5. If doctor takes an unplanned break: Staff clicks "Pause Queue", sets status to `BUSY` / `ON_BREAK`, and specifies expected resume time. System adjusts wait time estimates for all waiting patients.

### 4.7 Doctor Workflow
1. Doctor logs into dashboard and views "Current Patient" and "Next Patient".
2. When patient enters consultation room, doctor (or staff) clicks "Start Consultation" (`IN_CONSULTATION`).
3. Upon finishing, doctor clicks "Complete Consultation" (`COMPLETED`).
4. Dashboard automatically updates daily completed count and highlights the next patient.

### 4.8 Doctor Availability & Break Workflow
1. Clinic Admin configures weekly recurring schedule (e.g., Mon–Fri 09:00–13:00, 14:00–18:00; Lunch Break 13:00–14:00).
2. During live operations, staff can set temporary status overrides (`BUSY`, `ON_BREAK`, `UNAVAILABLE`) with expected resume time (e.g., 03:30 PM).
3. The underlying recurring schedule remains untouched. Wait time calculations add the pause/break duration to expected consultation windows. When doctor returns, staff sets status back to `AVAILABLE`.

### 4.9 Queue Estimation Workflow
1. System queries active `WAITING` entries ahead of target patient.
2. Multiplies count by average consultation duration (or service-specific duration).
3. Adds remaining duration of currently active `IN_CONSULTATION` patient.
4. Adds any upcoming scheduled breaks or temporary unavailable durations falling before patient's estimated call time.
5. Returns Range: `[MinEstimate, MaxEstimate]` (e.g., 35–45 minutes) and Recommended Arrival: `[ExpectedStart - 15 mins]`.

---

## 5. Contradictions

During documentation audit, the following minor specification discrepancies were identified:

1. **Token Allocation Timing Discrepancy (PRD vs. Architecture):**
   - *PRD.md FR-07 & Acceptance Scenario* suggests online patients get a token number immediately upon booking (`BOOKED` -> Token assigned).
   - *ARCHITECTURE.md Section 7* indicates state machine sequence: `BOOKED` -> `CHECKED_IN` -> `WAITING`.
   - *Impact:* If an online patient booking 3 days in advance receives Token #5 today, it conflicts with real-time sequential token allocation for walk-ins on that future date.
   - *Resolution:* Clarify that future online bookings receive an **Appointment Reference / Slot**, which converts to a sequential **Queue Token** upon daily queue activation or patient check-in on the day of appointment.

2. **Queue Visibility Rule Wording in Phase 06 vs. Phase 10:**
   - *PHASE_06.md* states queue details become visible when entering the appointment decision flow. *PHASE_10.md* describes queue tracking screen details post-booking.
   - *Impact:* Potential confusion on whether pre-booking queue preview uses identical fields as post-booking live tracking.
   - *Resolution:* Explicitly unify Stage 3 preview metrics with Stage 3 active tracking metrics.

---

## 6. Ambiguous Requirements

The following requirements require explicit business rule definitions prior to code implementation:

1. **Hybrid Queue Ordering Algorithm:**
   - How are walk-in patients merged with fixed-time online appointments during active queue processing?
   - *Needs Definition:* Does the system use strict FIFO by arrival/check-in time, or slot-interleaving (e.g., 1 appointment slot followed by 1 walk-in slot if capacity permits)?

2. **Check-In Window & No-Show Auto-Expiry:**
   - How late can an online appointment patient arrive before their slot is skipped or marked `NO_SHOW`?
   - *Needs Definition:* Is check-in required 15 minutes prior to slot time? Does the system automatically flag overdue appointments, or is it purely manual staff action?

3. **Rejoin Queue Position Policy:**
   - When a receptionist clicks "Rejoin" for a `SKIPPED` or `NO_SHOW` patient, where are they placed in the queue?
   - *Needs Definition:* Do they get a brand-new token appended to the end of the queue, or are they placed N positions behind the current serving token?

4. **Distance Calculation Reference Point:**
   - How is patient location obtained if browser geolocation permission is denied?
   - *Needs Definition:* Fallback to manual pincode/city entry or clinic default area.

---

## 7. Missing Business Rules

The following business rules must be established before implementation:

1. **Atomic Token Generation Counter Rule:**
   - Token numbers MUST be generated sequentially per `{ doctorId, clinicId, date }` scope using atomic database operations (`findOneAndUpdate` on a dedicated counter collection or atomic transaction) to prevent duplicate token issues under concurrent staff submissions.

2. **Idempotency Control on Queue Actions:**
   - All state transition endpoints (`/call`, `/start`, `/complete`, `/skip`, `/pause`) MUST validate current state before transitioning. If Receptionist A and Receptionist B double-click "Call Next", the second request must safely return the current `CALLED` state without advancing the queue twice.

3. **Verified Rating Eligibility Rule:**
   - A rating can ONLY be created if `QueueEntry.status === 'COMPLETED'`, `patientId` matches the authenticated user, and no prior `Rating` record exists for that `queueEntryId`.

4. **Break-Time Overlap Rule during Online Booking:**
   - Online appointment slots must automatically filter out time slots that overlap with configured doctor break windows (e.g., 1:00 PM – 2:00 PM lunch break).

---

## 8. Edge Cases

The following real-world scenarios must be accounted for in backend logic and UI states:

1. **Doctor becomes unavailable mid-day:** Staff sets status to `UNAVAILABLE` with expected resume time. Active `WAITING` queue remains intact. Patient estimation engine pauses wait counters and displays "Doctor Temporarily Unavailable — Expected Resume at HH:MM".
2. **Doctor becomes available again:** Staff sets status to `AVAILABLE`. Queue execution resumes seamlessly, recalculating wait ranges.
3. **Lunch / Scheduled Break:** System automatically factor scheduled break duration into wait times for patients whose estimated consultation falls after the break start time.
4. **Appointment cancellation:** Patient or staff cancels `BOOKED` or `WAITING` entry. Status updates to `CANCELLED`. Queue position is freed; wait times for all subsequent patients shrink immediately.
5. **Walk-in patient arrival:** Staff registers/selects patient, selects doctor/service. System atomically allocates next token (e.g., #21) and inserts `QueueEntry` with source `WALK_IN`.
6. **No-show patient:** Patient called (`CALLED`) fails to appear. Staff clicks `NO_SHOW`. System logs state transition and advances queue to next patient.
7. **Skipped patient:** Patient temporarily steps away. Staff clicks `SKIP`. State changes to `SKIPPED`. Queue moves forward without cancelling patient record.
8. **Rejoin queue:** Skipped patient returns. Staff clicks `REJOIN`. System assigns valid queue position/token according to policy and resets state to `WAITING`.
9. **Two receptionists adding walk-ins simultaneously:** Receptionist A and B hit "Add Walk-in" at the exact same millisecond. MongoDB atomic counter guarantees Receptionist A gets Token #35 and Receptionist B gets Token #36 without race conditions or duplicates.
10. **Duplicate booking attempt:** Patient attempts double submission for same doctor and date. Compound unique index `{ patientId, doctorId, date, status: active }` rejects second request with meaningful error.
11. **Patient leaves queue voluntarily:** Patient cancels token via mobile interface. Status updates to `CANCELLED`, freeing queue position for others.
12. **Queue becomes empty:** All patients completed or cancelled. Doctor status shows "No patients waiting". Estimation logic returns 0 wait time without division-by-zero or `NaN` errors.
13. **Doctor finishes consultation early:** Consultation marked `COMPLETED` faster than average duration. System recalculates remaining wait times downwards on next poll.
14. **Doctor runs late:** Consultations take longer than average. System dynamically recalculates wait ranges upwards based on real elapsed time.
15. **Multiple doctors in one clinic:** System maintains separate independent queues, counters, schedules, and active statuses for each doctor. Staff panel provides doctor switcher tab.
16. **Multiple clinics for one doctor:** Doctor works at Clinic A on Mon/Wed and Clinic B on Tue/Thu. Schedules and queues are strictly isolated by `{ clinicId, doctorId, date }`.
17. **Patient already has active appointment:** Re-booking attempt for same doctor session is rejected with "You already have an active appointment/token with this doctor."
18. **Staff double-clicks action button:** Double-clicking "Call Next" or "Start Consultation" is safely caught by backend state checks, preventing accidental double skipping.

---

## 9. Database Risks

Identified schema and data modeling risks across the 10 domain entities:

| Entity | Potential Risk | Mitigation Strategy |
| :--- | :--- | :--- |
| **User** | Password plain text exposure / weak auth; missing role enum checks. | Use bcrypt password hashing; strict Mongoose enum for roles (`PATIENT`, `DOCTOR`, `STAFF`, `ADMIN`); index on `email` and `phone`. |
| **Clinic** | Inefficient distance queries. | Add MongoDB `2dsphere` index on `location.coordinates` (`[longitude, latitude]`). |
| **Doctor** | Rating calculation performance bottle-neck; unindexed queries. | Denormalize `averageRating` and `totalReviews` on Doctor model, updated atomically upon rating submission; index `{ clinicId, specialtyId }`. |
| **Patient** | Slow receptionist lookup during walk-in creation. | Create index on `phone` field for sub-second patient search by staff. |
| **Appointment** | Double booking race conditions on time slots. | Compound unique index on `{ doctorId, date, timeSlot, status: { $ne: 'CANCELLED' } }`. |
| **QueueEntry** | Duplicate token generation; state inconsistency. | Dedicated `QueueCounter` collection for atomic token increment; compound index on `{ doctorId, date, tokenNumber }` and `{ doctorId, date, status, queueOrder }`. |
| **DoctorSchedule** | Complex break representation causing overlapping slot bugs. | Store daily shifts as structured arrays (`shifts: [{ startTime, endTime }]`, `breaks: [{ startTime, endTime, label }]`). |
| **QueueHistory** | Unbounded growth / missing audit trails. | Log every state transition with `entryId`, `previousStatus`, `newStatus`, `changedBy`, and `timestamp`. |
| **Rating** | Unverified or duplicate ratings. | Compound unique index on `{ queueEntryId }` ensuring 1 rating per completed consultation. |

---

## 10. Queue Logic Risks

1. **Race Conditions during Token Generation:** Standard Mongoose `countDocuments()` + 1 strategy will lead to duplicate tokens under concurrent traffic. Dedicated atomic counter is mandatory.
2. **Desynchronization between Appointment & Queue State:** If an appointment is cancelled, its corresponding `QueueEntry` must be updated atomically to `CANCELLED` within a database transaction or atomic service call.
3. **Stale Polling Data overwrite:** Frontend HTTP polling could overwrite a user's UI while they are interacting with an action modal. UI components must separate background data refresh from local component interaction state.

---

## 11. Security / Authorization Risks

1. **Privilege Escalation via Self-Registration:** If `/api/auth/register` accepts a `role` payload parameter without restriction, arbitrary users could register as `ADMIN` or `STAFF`. Registration endpoint MUST force `role = 'PATIENT'`. Staff and Doctor accounts must be created exclusively by Clinic Admin.
2. **Insecure Direct Object References (IDOR) on Queue Manipulation:** A patient could attempt to invoke `PATCH /api/queue/:id/call` or cancel another patient's token. Server-side middleware MUST enforce role check (`STAFF` or `DOCTOR` only for queue ops) and ownership check (Patient can only cancel their own token).
3. **Session / Cookie Security:** Session tokens must be stored in `httpOnly`, `sameSite=strict`, and `secure` (in production) cookies to prevent XSS attacks from reading auth state.

---

## 12. Phase Readiness

| Phase | Description | Readiness Status | Rationale / Prerequisite |
| :--- | :--- | :--- | :--- |
| **PHASE 01** | Project Foundation | **READY** | MERN setup, Express app structure, MongoDB connection, health check endpoint defined. |
| **PHASE 02** | Data Models | **READY** | Locked: `QueueCounter` entity added (`clinicId`, `doctorId`, `date`, `lastTokenNumber`) and entity distinctions confirmed. |
| **PHASE 03** | Auth & Roles | **READY** | Role middleware (`PATIENT`, `DOCTOR`, `STAFF`, `ADMIN`) and session handling rules specified. |
| **PHASE 04** | Clinic, Doctor & Schedule | **READY** | Decoupled recurring schedule and daily operational status overrides locked. |
| **PHASE 05** | Patient Discovery | **READY** | 3-stage UX Stage 1 constraints (no queue metrics on cards) fully established. |
| **PHASE 06** | Appointment Flow | **READY** | Locked: Online booking creates `Appointment` in `BOOKED` state; token allocated upon clinic check-in. |
| **PHASE 07** | Walk-in Registration | **READY** | Locked: Walk-in creation uses atomic `$inc` on `QueueCounter` for token generation. |
| **PHASE 08** | Queue Engine | **READY** | Locked: HYBRID queue ordering algorithm deterministically combines slot windows and walk-ins. |
| **PHASE 09** | Staff & Doctor Dashboards | **READY** | Role division (Staff = Queue Operator, Doctor = Clinical) clearly defined. |
| **PHASE 10** | Patient Queue Tracking | **READY** | Stage 3 metrics and HTTP polling refresh mechanism established. |
| **PHASE 11** | Ratings & Analytics | **READY** | Verified rating constraint (completed queue entry required) locked. |
| **PHASE 12** | Hardening & Release | **READY** | Validation, security audit, concurrency testing checklist defined. |

---

## 13. Recommended Changes (Formally Incorporated)

All recommended architectural changes have been locked and integrated into the project documentation:

1. **`QueueCounter` Schema Concept:** Dedicated MongoDB collection for atomic counter management per doctor per date (`{ clinicId, doctorId, date, lastTokenNumber }`).
2. **Token Allocation Timing:** Online bookings receive an `Appointment` record in `BOOKED` state without a token. A `QueueEntry` and token are generated ONLY upon clinic check-in.
3. **Hybrid Queue Ordering Engine:** Deterministic algorithm combining appointment windows and walk-in arrivals without arbitrarily reordering actively waiting patients.
4. **Idempotent Queue Controller Logic:** Queue transition endpoints (`call`, `start`, `complete`, `skip`, `pause`) enforce strict current-state validation to prevent double-click issues.

---

## 14. Final Implementation Readiness

### **READY TO IMPLEMENT**

*Rationale:* All three critical architectural ambiguities (Token Allocation Timing, Atomic QueueCounter, and Hybrid Queue Ordering) have been formally resolved, documented, and locked in `DECISIONS.md`, `PRD.md`, `ARCHITECTURE.md`, `DEVELOPMENT_RULES.md`, and `IMPLEMENTATION_PLAN.md`. All phases are marked **READY**, and all core business rules and edge cases are consistent. The project is ready for Phase 01 implementation upon instruction.

---
*Audit completed and updated for QFlow platform specification context.*
