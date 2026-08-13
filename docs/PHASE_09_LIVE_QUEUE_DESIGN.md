# Phase 09 — Patient Live Queue Experience Architecture & Design Specification

## Executive Summary

Phase 09 delivers the **Patient-Facing Live Queue Experience** for QFlow. It enables patients who have checked in online or registered as walk-ins (Phase 07) to track their real-time operational queue progress safely, accurately, and privately.

The Patient Live Queue Experience provides:
1. **Privacy-Preserved Patient Status Snapshot:** Secure, patient-owned queue tracking exposing zero personal details of other patients.
2. **Phase 08 HYBRID Queue Position Calculation:** Reuses the exact server-authoritative HYBRID ordering algorithm (`priorityWeight` → `effectiveSlotMinutes` → `joinedAt` → `tokenNumber`) to compute accurate, real-time queue position and people ahead.
3. **Current Serving Token & State Tracking:** Real-time visibility into whether a doctor is actively serving a patient (`CALLED` vs `IN_CONSULTATION` vs `IDLE`), and whether the queue is currently paused.
4. **Transparent Wait-Time Estimation:** Deterministic, doctor-specific wait-time calculations derived from `Doctor.averageConsultationDurationMinutes` and position ahead.
5. **Resilient Real-Time Transport:** Lightweight, battery-efficient 10-second polling transport with exponential backoff, background tab throttling, and manual pull-to-refresh fallback.
6. **Strict Ownership & IDOR Protection:** JWT-authenticated access scoped strictly to the authenticated patient's own `Patient._id` and `QueueEntry`.

---

## 1. Architecture & Core Boundaries

### 1.1 Strict Boundary Rules
- **Phase 09 Scope:** Patient-facing live queue REST endpoints, server-authoritative queue position and wait-time calculation, privacy boundary enforcement, real-time polling transport, React Patient Live Queue UI components, and automated validation suite (`validatePhase09.js`).
- **Phase 10+ Scope (Forbidden in Phase 09):** Payment gateway integration, patient reviews/ratings submission, SMS/WhatsApp push notification gateways, external WebSocket/Redis cluster servers, and AI wait-time machine learning predictions.

### 1.2 Entity Relationship Map
```
               [ User (PATIENT) ]
                       │ (JWT Auth)
                       ▼
                 [ Patient ]
                       │
                       ▼
               [ QueueEntry ] ◄──────────── [ Doctor ]
          (status, token, position)     (avgDuration, isPaused)
                       │
                       ▼
      [ Patient Live Queue Controller ]
     (HYBRID Ordering & Privacy Filter)
                       │
                       ▼
       [ Patient Live Queue UI (React) ]
        (Status, Token, Serving, Wait)
```

---

## 2. Patient User Journey & Queue States

### 2.1 User Journey Flow
```
Patient Checks In (Phase 07) / Views Appointment
                        ↓
         Navigates to Live Queue Card
                        ↓
             Authenticates via JWT
                        ↓
     Fetches Initial Queue Snapshot (REST API)
                        ↓
      Displays: Own Token | Current Serving | Position | Est. Wait
                        ↓
          Polling Auto-Refresh (Every 10s)
                        ↓
   State Changes: WAITING ──► CALLED ──► IN_CONSULTATION ──► COMPLETED
                        ↓
           View Updates to Terminal State Summary
```

### 2.2 Queue State UI Matrix

| Queue State | Status Badge | Serving Display | Position & People Ahead | Estimated Wait | UI Action / Notice |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`WAITING`** | `WAITING` (Blue) | Displays `currentServingToken` & serving status | Calculated Position (#N) & `peopleAhead` | `(peopleAhead * avgDuration)` mins | Show live progress indicator & refresh timestamp |
| **`CALLED`** | `YOUR TURN` (Pulsing Green) | Shows `currentServingToken` = Own Token | Position: `0`, People Ahead: `0` | `0 mins (Proceed to Room)` | Audio/Visual alert: *"Please proceed to Doctor's Consultation Room"* |
| **`IN_CONSULTATION`** | `IN CONSULTATION` (Green) | Shows `currentServingToken` = Own Token | Position: `0`, People Ahead: `0` | `0 mins` | Display *"Consultation in Progress"* banner |
| **`COMPLETED`** | `COMPLETED` (Gray/Check) | `currentServingToken` of active queue | N/A | N/A | Show *"Consultation Completed"* summary card |
| **`SKIPPED`** | `SKIPPED` (Orange) | Active serving token | N/A | N/A | Display *"You were skipped. Please approach Reception to Rejoin."* |
| **`NO_SHOW`** | `NO SHOW` (Red) | Active serving token | N/A | N/A | Display *"Marked No-Show. Please contact reception desk."* |
| **`CANCELLED`** | `CANCELLED` (Red) | N/A | N/A | N/A | Display *"Queue entry cancelled."* |

---

## 3. Privacy & Data Boundary Specification

### 3.1 Privacy Requirements (CRITICAL)
Patients monitoring the queue must **NEVER** receive or inspect private data of other patients.

#### STRICTLY FORBIDDEN FOR OTHER PATIENTS:
- Full Names, Initial Letters, or Pseudonyms of other patients
- Phone Numbers or Contact Details
- Medical Conditions, Symptoms, or Notes
- Appointment IDs or Database `_id`s of other patients
- Operational `QueueHistory` audit logs
- Staff/Receptionist IDs or comments

#### ALLOWED PATIENT-FACING DATA FIELDS:
- **Own Identity & Entry:** Patient's own `tokenNumber`, `source`, `priority`, `status`, `joinedAt`, `effectiveSlotMinutes`.
- **Active Serving State:** `currentServingToken` (Number), `servingState` (`'CALLED'`, `'IN_CONSULTATION'`, or `'IDLE'`).
- **Calculated Queue Progress:** `queuePosition` (Integer), `peopleAhead` (Integer), `estimatedWaitMinutes` (Integer).
- **Queue Control State:** `isQueuePaused` (Boolean), `queuePauseReason` (String, if paused).
- **Doctor & Clinic Profile:** Doctor `fullName`, `photoUrl`, `operationalStatus`, Clinic `name`.

---

## 4. Patient Authorization & Ownership Security

### 4.1 Strict Ownership Verification
- Every live queue API endpoint enforces JWT authentication (`protect`, `authorize('PATIENT')`).
- Patient identity is resolved strictly server-side:
  ```javascript
  const userId = req.user._id || req.user.id;
  const patient = await Patient.findOne({ userId });
  ```
- Ownership match check:
  ```javascript
  if (!queueEntry.patientId.equals(patient._id)) {
    return res.status(403).json({ success: false, message: 'Unauthorized to view this queue entry' });
  }
  ```
- **IDOR Protection:** Clients cannot pass arbitrary `patientId` in request bodies or query params to inspect other queues.

---

## 5. API Contracts

### 5.1 Endpoint Specifications

#### 1. Get Live Queue Snapshot for Current Active Entry
- **HTTP Method:** `GET`
- **Route:** `/api/patient/queue/live`
- **Access:** Private (`PATIENT`)
- **Query Parameters:** `appointmentId` (Optional)
- **Description:** Returns the live queue tracking snapshot for the patient's active queue entry today.

#### Response Schema (`HTTP 200 OK`):
```json
{
  "success": true,
  "hasActiveEntry": true,
  "queue": {
    "queueEntryId": "66bc8d1f2a4b",
    "tokenNumber": 4,
    "status": "WAITING",
    "priority": "NORMAL",
    "source": "ONLINE",
    "joinedAt": "2026-08-14T09:15:00.000Z",
    "currentServingToken": 2,
    "servingState": "IN_CONSULTATION",
    "queuePosition": 2,
    "peopleAhead": 1,
    "estimatedWaitMinutes": 15,
    "isEstimated": true,
    "isQueuePaused": false,
    "queuePauseReason": null,
    "doctor": {
      "_id": "66bc8c901f1a",
      "fullName": "Dr. Sarah Jenkins",
      "photoUrl": "https://example.com/doctors/sarah.jpg",
      "operationalStatus": "AVAILABLE"
    },
    "clinic": {
      "_id": "66bc8c500e2b",
      "name": "City Health Medical Center"
    },
    "lastUpdated": "2026-08-14T09:30:00.000Z"
  }
}
```

#### No Active Entry Response (`HTTP 200 OK`):
```json
{
  "success": true,
  "hasActiveEntry": false,
  "message": "No active queue entry found for today"
}
```

#### Error Responses:
- `HTTP 401 Unauthorized`: Missing or invalid JWT.
- `HTTP 403 Forbidden`: Non-patient role or cross-patient resource attempt.
- `HTTP 404 Not Found`: Patient profile not found.

---

## 6. Deterministic Queue Position Algorithm

### 6.1 Server-Authoritative Position Calculation
Phase 09 reuses the exact Phase 08 HYBRID queue ordering criteria:
```javascript
const sortCriteria = {
  priorityWeight: 1,        // URGENT (0) before NORMAL (1)
  effectiveSlotMinutes: 1,  // Scheduled slot or arrival minutes past midnight
  joinedAt: 1,              // Check-in millisecond timestamp
  tokenNumber: 1            // Monotonic tie-breaker
};
```

### 6.2 Step-by-Step Calculation Logic
1. Fetch target patient's active `QueueEntry` (`myEntry`).
2. If `myEntry.status` is `'CALLED'` or `'IN_CONSULTATION'`:
   - `queuePosition = 0`, `peopleAhead = 0`.
3. If `myEntry.status` is `'WAITING'`:
   - Query all `WAITING` entries for `{ doctorId: myEntry.doctorId, queueDate: myEntry.queueDate, status: 'WAITING' }`.
   - Apply `sortCriteria`.
   - Find array index of `myEntry._id`:
     - `queuePosition = index + 1`
     - `peopleAhead = index`
4. If `myEntry.status` is terminal (`'COMPLETED'`, `'SKIPPED'`, `'NO_SHOW'`, `'CANCELLED'`):
   - `queuePosition = null`, `peopleAhead = 0`.

---

## 7. Current Serving Token Logic

### 7.1 Serving Token Resolution
For a given `{ doctorId, queueDate }`:
1. Query active entries:
   ```javascript
   const activeEntries = await QueueEntry.find({
     doctorId,
     queueDate,
     status: { $in: ['CALLED', 'IN_CONSULTATION'] }
   });
   ```
2. Priority check:
   - If an entry exists with `status === 'IN_CONSULTATION'`:
     - `currentServingToken = entry.tokenNumber`
     - `servingState = 'IN_CONSULTATION'`
   - Else if an entry exists with `status === 'CALLED'`:
     - `currentServingToken = entry.tokenNumber`
     - `servingState = 'CALLED'`
   - Else:
     - `currentServingToken = null`
     - `servingState = 'IDLE'`

---

## 8. Wait-Time Estimation Formula

### 8.1 Data Sources & Formula
Wait time is calculated using `Doctor.averageConsultationDurationMinutes` (default 15 minutes):

$$\text{estimatedWaitMinutes} = (\text{peopleAhead} \times \text{averageDuration}) + \text{activeConsultationRemainder}$$

Where:
- `peopleAhead`: Number of `WAITING` patients ahead in HYBRID order.
- `activeConsultationRemainder`: If a patient is currently `IN_CONSULTATION`, add estimated remaining consultation time ($\approx 50\%$ of `averageDuration`, i.e., $7.5$ mins rounded to $8$). If `CALLED` or `IDLE`, add $0$.

### 8.2 Boundary Rules for Wait-Time
- If `myEntry.status` is `'CALLED'` or `'IN_CONSULTATION'` $\rightarrow$ `estimatedWaitMinutes = 0`.
- If `Doctor.isQueuePaused === true` $\rightarrow$ Add notice *"Queue Paused"* alongside estimated duration.
- Estimates are returned as integers and explicitly flagged with `isEstimated: true`.

---

## 9. Real-Time Transport Architecture Decision

### 9.1 Evaluation of Options

| Criterion | Short Polling (10s) | Server-Sent Events (SSE) | WebSockets (Socket.IO) |
| :--- | :--- | :--- | :--- |
| **Server Infrastructure Impact** | Zero new dependencies (Express REST) | Minimal (HTTP stream connection) | Requires socket server / Redis adapter |
| **Browser Compatibility** | 100% universal | High (`EventSource`) | High (WS client) |
| **Battery & Mobile Performance** | Excellent with background tab pause | Good | Can drain mobile battery if idle |
| **Reconnection Resilience** | Native HTTP retry | Automatic reconnect | Custom reconnect handler required |
| **Implementation Complexity** | Low & robust | Medium | High |

### 9.2 Architecture Decision
**Phase 09 Transport Choice:** **Short Polling (10-Second Interval)** with smart client throttling:
- Client polls `GET /api/patient/queue/live` every **10 seconds** when page is visible.
- Automatically pauses polling when browser tab becomes hidden (`document.hidden`).
- Immediately resumes and polls upon tab focus (`visibilitychange` event).
- Includes manual "Refresh Queue" pull-to-refresh button for instant user feedback.

---

## 10. Security & IDOR Verification

1. **JWT Verification:** Middleware `protect` verifies token signature and expiration.
2. **Role Enforcement:** Middleware `authorize('PATIENT')` blocks `STAFF`, `DOCTOR`, or `ADMIN` tokens from patient endpoints.
3. **Patient Ownership:** Controller queries `Patient` document linked to `req.user._id` and matches `QueueEntry.patientId`.
4. **Data Minimization:** Response payload strictly filters out all other patient data.

---

## 11. Database & Schema Amendments

Zero schema changes are required for Phase 09.
Existing models (`QueueEntry`, `Doctor`, `Appointment`, `Patient`) contain all necessary fields and indexes (`hybrid_queue_ordering_idx`).

---

## 12. Phase 10 Boundary Rules

Phase 09 MUST NOT implement:
- Payment processing or fee collection.
- Rating submission or doctor reviews.
- SMS/WhatsApp notification gateways.
- External WebSocket server deployment.
- Medical record access or prescriptions.

---

## 13. Edge Cases & Failure Scenarios (20 Scenarios)

1. **Patient Has No Active Queue Entry:** Returns `hasActiveEntry: false` gracefully.
2. **Appointment Cancelled by Staff:** Live queue status updates to `CANCELLED`.
3. **Patient Skipped by Staff:** Status updates to `SKIPPED` with instructions to contact reception.
4. **Patient Rejoins Queue:** Status transitions `SKIPPED` $\rightarrow$ `WAITING` with updated token and position.
5. **Doctor Pauses Queue:** `isQueuePaused` set to `true`, UI displays paused alert banner.
6. **Doctor Resumes Queue:** `isQueuePaused` set to `false`, UI alert banner clears.
7. **Doctor Offline / Unavailable:** UI displays doctor operational status (`ON_BREAK`, `UNAVAILABLE`).
8. **Queue Empty (Patient is #1):** `queuePosition: 1`, `peopleAhead: 0`.
9. **Patient Called for Consultation:** Status updates to `CALLED`, UI shows pulsing green alert.
10. **Consultation Started:** Status updates to `IN_CONSULTATION`.
11. **Consultation Completed:** Status updates to `COMPLETED`, UI shows completion summary card.
12. **Patient Marked No-Show:** Status updates to `NO_SHOW`.
13. **Network Interruption During Poll:** Client retries gracefully on next interval.
14. **Tab Backgrounded:** Polling pauses automatically, saving mobile battery and server load.
15. **Tab Refocused:** Polling triggers instantly to fetch latest state.
16. **Multiple Browser Tabs Open:** All tabs display consistent server-authoritative snapshot.
17. **JWT Token Expires:** HTTP 401 response triggers client redirect to login screen.
18. **Cross-Patient Access Attempt:** HTTP 403 response blocks unauthorized access.
19. **Walk-In Patient Live Queue:** Walk-in patients without user accounts can track via phone/token verification lookup.
20. **Rapid Queue State Transitions:** Consecutive state changes (`CALLED` $\rightarrow$ `IN_CONSULTATION` $\rightarrow$ `COMPLETED`) render accurately on next poll.

---

## 14. Acceptance Criteria

Phase 09 will be complete when:
- [ ] `GET /api/patient/queue/live` returns accurate, patient-safe queue snapshot.
- [ ] Zero private information of other patients is exposed in any response.
- [ ] Queue position strictly adheres to Phase 08 HYBRID ordering.
- [ ] React Patient Live Queue UI component renders live status, token, position, serving token, and wait time.
- [ ] Polling transport refreshes state every 10s and pauses when backgrounded.
- [ ] Automated test suite `validatePhase09.js` passes 100%.
- [ ] All prior regression suites (Phases 03–08) pass 100%.
- [ ] `npm run build:client` compiles with 0 errors.

---

## 15. Implementation Plan Steps

1. **Step 1:** Implement `getPatientLiveQueue` in `patientQueueController.js` (or `appointmentController.js`).
2. **Step 2:** Mount `GET /api/patient/queue/live` route in `patientQueueRoutes.js`.
3. **Step 3:** Add `getPatientLiveQueue` helper method in `src/client/src/services/api.js`.
4. **Step 4:** Build `PatientLiveQueueCard` React component in `src/client/src/App.jsx`.
5. **Step 5:** Create automated test suite `src/server/utils/validatePhase09.js`.
6. **Step 6:** Execute validation suite & regression tests.
7. **Step 7:** Run client production build (`npm run build:client`).
8. **Step 8:** Perform Phase 09 read-only code audit.
9. **Step 9:** Execute Git Checkpoint commit (`feat: implement patient live queue experience`).
