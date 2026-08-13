# Phase 10 — Public Queue Display, Verified Ratings & Notification Architecture Design Specification

## Executive Summary

Phase 10 expands the QFlow platform by delivering three patient-facing and operational enhancements:
1. **Public Clinic Queue Display Board:** Unauthenticated, privacy-preserving live queue display for TV/wall monitors in clinic waiting areas, showing anonymous token numbers, currently serving state, and queue pause status.
2. **Verified Patient Ratings & Doctor Reviews Engine:** Server-verified rating system allowing patients to rate and review doctors **only after a consultation status becomes `COMPLETED`**, enforcing strict 1-rating-per-consultation uniqueness and atomic doctor rating recalculation.
3. **In-App Queue Notification Service:** Database-backed, real-time alert system notifying patients when they are called (`PATIENT_CALLED`), when their consultation finishes, or when a doctor pauses the queue (`QUEUE_PAUSED`).

Phase 10 preserves all prior Phase 03–09 guarantees, including server-authoritative state, Phase 08 HYBRID queue ordering, Phase 09 patient privacy boundaries, and IST timezone rules.

---

## 1. Scope & Feature Boundaries

### 1.1 In-Scope (Phase 10 Deliverables)
- **Public Queue Display API & UI:** `GET /api/public/queue/display` (Read-only, anonymous token display board for waiting rooms).
- **Verified Patient Ratings API & UI:** `POST /api/patient/ratings` and `GET /api/doctors/:id/ratings` (Restricted to `COMPLETED` consultations).
- **In-App Notification API & UI:** `GET /api/patient/notifications` and `PATCH /api/patient/notifications/:id/read` (Patient alerts for queue events).
- **New Notification Model:** `Notification.js` schema and indexes.
- **Automated Phase 10 Validation & Regression Suite:** `src/server/utils/validatePhase10.js`.

### 1.2 Out-of-Scope (Deferred to Phase 11+)
- **Payment Processing / Gateways (Razorpay/Stripe):** Deferred to Phase 11.
- **Third-Party Paid SMS / WhatsApp Gateways (Twilio/Meta API):** Abstracted in Phase 10 notification pipeline; provider gateway keys deferred to Phase 11.
- **Analytics & Daily Clinic Throughput Reporting:** Deferred to Phase 11.
- **AI Machine Learning Wait Predictions:** Deferred to Phase 12.

---

## 2. Architecture & Data Flow

```
                      ┌───────────────────────────────────────────────┐
                      │   Public Clinic Display Board (TV Monitor)   │
                      └──────────────────────┬────────────────────────┘
                                             │ GET /api/public/queue/display (Anonymous Tokens)
                                             ▼
┌──────────────────────┐             ┌───────────────┐             ┌─────────────────────┐
│  Patient Live Queue  │────────────►│  QFlow Engine │────────────►│ Verified Ratings &  │
│  (Phase 09 Snapshot) │             │ (Express/MDB) │             │ Notification Engine │
└──────────────────────┘             └───────┬───────┘             └─────────────────────┘
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │  MongoDB Atlas Store      │
                               │  - QueueEntry             │
                               │  - Rating (Unique Index)  │
                               │  - Notification (In-App)  │
                               │  - Doctor (Avg Rating)    │
                               └───────────────────────────┘
```

---

## 3. Security & Privacy Boundary

### 3.1 Public Display Privacy Rules (CRITICAL)
The Public Display Board API (`GET /api/public/queue/display`) is accessible without authentication to power clinic wall monitors.
- **ALLOWED FIELDS:** Clinic `name`, Doctor `fullName`, `operationalStatus`, `isQueuePaused`, `queuePauseReason`, `currentServingToken` (Number), `servingState` (`'CALLED'` / `'IN_CONSULTATION'`), `waitingTokens` (Array of Token Numbers e.g. `[5, 6, 7]`), `calledTokens` (Array of Token Numbers e.g. `[4]`).
- **STRICTLY FORBIDDEN FOR PUBLIC DISPLAY:**
  - Zero Patient Names or Initials.
  - Zero Phone Numbers or Contact Details.
  - Zero Medical Symptoms, Notes, or Specialty Codes.
  - Zero Appointment IDs or Database `_id`s of Patients.
  - Zero Staff / Receptionist User Details.

### 3.2 Rating Authorization & Eligibility Rules
- **Role:** `PATIENT` only (`protect`, `authorize('PATIENT')`).
- **Eligibility Check:** Patient can submit a rating **ONLY IF**:
  1. `QueueEntry._id` exists and belongs to authenticated patient (`queueEntry.patientId.equals(patient._id)`).
  2. `QueueEntry.status === 'COMPLETED'`.
  3. No rating has been submitted previously for this `queueEntryId` (enforced by `Rating` model unique index).
- **Rejection Conditions:**
  - `WAITING`, `CALLED`, `IN_CONSULTATION` $\rightarrow$ `HTTP 400 Bad Request` ("Consultation must be completed before rating").
  - `CANCELLED` or `NO_SHOW` $\rightarrow$ `HTTP 400 Bad Request` ("Cannot rate cancelled or no-show consultations").
  - Duplicate submission for same `queueEntryId` $\rightarrow$ `HTTP 409 Conflict` ("Rating already submitted for this consultation").
  - Rating another patient's entry $\rightarrow$ `HTTP 403 Forbidden` ("Unauthorized to rate this consultation").

---

## 4. Data Model Specifications

### 4.1 Existing `Rating.js` Model Verification
```javascript
const ratingSchema = new mongoose.Schema(
  {
    queueEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'QueueEntry', required: true },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    reviewText: { type: String, trim: true, default: null },
  },
  { timestamps: true }
);

ratingSchema.index({ queueEntryId: 1 }, { unique: true });
ratingSchema.index({ doctorId: 1, createdAt: -1 });
```

### 4.2 New `Notification.js` Model Specification
```javascript
import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Patient ID is required'],
    },
    queueEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QueueEntry',
      default: null,
    },
    type: {
      type: String,
      enum: ['PATIENT_CALLED', 'CONSULTATION_STARTED', 'CONSULTATION_COMPLETED', 'PATIENT_SKIPPED', 'QUEUE_PAUSED', 'QUEUE_RESUMED'],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ patientId: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
```

---

## 5. API Contracts

### 5.1 `GET /api/public/queue/display`
- **Access:** Public (No JWT required)
- **Query Parameters:** `clinicId` (Required), `doctorId` (Optional)
- **Description:** Returns anonymous token display data for clinic TV monitors.
- **Response Payload (`HTTP 200 OK`):**
  ```json
  {
    "success": true,
    "clinicName": "City Health Medical Center",
    "doctor": {
      "fullName": "Dr. Sarah Jenkins",
      "operationalStatus": "AVAILABLE",
      "isQueuePaused": false,
      "queuePauseReason": null
    },
    "display": {
      "currentServingToken": 4,
      "servingState": "IN_CONSULTATION",
      "calledToken": 5,
      "nextWaitingTokens": [6, 7, 8],
      "totalWaitingCount": 3,
      "lastUpdated": "2026-08-14T09:45:00.000Z"
    }
  }
  ```

### 5.2 `POST /api/patient/ratings`
- **Access:** Private (`PATIENT`)
- **Headers:** `Authorization: Bearer <JWT>`
- **Request Body:**
  ```json
  {
    "queueEntryId": "66bc8d1f2a4b",
    "rating": 5,
    "reviewText": "Excellent consultation, doctor was very patient."
  }
  ```
- **Response Payload (`HTTP 201 Created`):**
  ```json
  {
    "success": true,
    "message": "Rating submitted successfully",
    "rating": {
      "_id": "66bc8e990b1c",
      "queueEntryId": "66bc8d1f2a4b",
      "doctorId": "66bc8c901f1a",
      "rating": 5,
      "reviewText": "Excellent consultation, doctor was very patient.",
      "createdAt": "2026-08-14T10:00:00.000Z"
    }
  }
  ```

### 5.3 `GET /api/doctors/:id/ratings`
- **Access:** Public / Patient
- **Description:** Returns public reviews for a doctor with patient anonymity (first name only).
- **Response Payload (`HTTP 200 OK`):**
  ```json
  {
    "success": true,
    "summary": {
      "averageRating": 4.8,
      "totalReviews": 25
    },
    "ratings": [
      {
        "rating": 5,
        "reviewText": "Very thorough diagnosis.",
        "patientFirstName": "Patient",
        "createdAt": "2026-08-14T10:00:00.000Z"
      }
    ]
  }
  ```

### 5.4 `GET /api/patient/notifications`
- **Access:** Private (`PATIENT`)
- **Description:** Fetches in-app notifications for the authenticated patient.

---

## 6. Concurrency, Idempotency & Transaction Strategy

### 6.1 Atomic Doctor Rating Recalculation
When a new rating is submitted:
1. Wrap rating creation and Doctor average rating update in a Mongoose session transaction:
   ```javascript
   const session = await mongoose.startSession();
   session.startTransaction();
   try {
     const newRating = await Rating.create([{ queueEntryId, doctorId, patientId, rating, reviewText }], { session });
     
     // Recalculate average rating & total count
     const stats = await Rating.aggregate([
       { $match: { doctorId: new mongoose.Types.ObjectId(doctorId) } },
       { $group: { _id: '$doctorId', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
     ]).session(session);

     const avgRating = stats[0] ? Math.round(stats[0].avgRating * 10) / 10 : rating;
     const count = stats[0] ? stats[0].count : 1;

     await Doctor.updateOne(
       { _id: doctorId },
       { averageRating: avgRating, totalReviews: count },
       { session }
     );

     await session.commitTransaction();
     session.endSession();
   } catch (error) {
     await session.abortTransaction();
     session.endSession();
     throw error;
   }
   ```
2. Uniqueness enforced by `queueEntryId` partial/unique index ensures zero duplicate rating submissions even on rapid double-clicks.

---

## 7. Frontend UI Components (React + Vanilla CSS)

1. **`PublicQueueDisplayBoard` Component:**
   - Fullscreen TV display layout with high-contrast typography.
   - Large Token Call cards (`Token #4 IN CONSULTATION`, `Token #5 CALLED`).
   - Auto-polling every 10 seconds.
2. **`RatingSubmissionModal` Component:**
   - 5-Star interactive picker + optional text review box.
   - Appears automatically or via button on `COMPLETED` appointments in Patient Portal.
3. **`NotificationBell` & Drawer Component:**
   - Unread badge counter on Patient top header.
   - Dropdown showing recent queue alerts (`"Your Turn! Token #5 Called for Dr. Jenkins"`).

---

## 8. Failure Scenarios & Edge Cases (20 Scenarios)

1. **Unauthenticated Public Display Query:** Returns anonymous token board cleanly (`HTTP 200`).
2. **Invalid Clinic ID in Public Display:** Returns `HTTP 400 Bad Request`.
3. **Rating Attempt Before Consultation Finishes (`WAITING`):** Rejected with `HTTP 400 Bad Request`.
4. **Rating Attempt for Cancelled Appointment:** Rejected with `HTTP 400 Bad Request`.
5. **Rating Attempt for No-Show Appointment:** Rejected with `HTTP 400 Bad Request`.
6. **Duplicate Rating Submission:** Rejected by unique index with `HTTP 409 Conflict`.
7. **Patient A Rating Patient B's Consultation:** Blocked with `HTTP 403 Forbidden`.
8. **Rating Score Out of Range (0 or 6 Stars):** Blocked by Mongoose validation (`min: 1, max: 5`).
9. **Rapid Double-Click on Submit Rating:** Transaction & unique index guarantee exactly 1 rating saved.
10. **Doctor Rating Recalculation Error:** Transaction aborts, rolling back rating submission.
11. **Doctor with Zero Ratings:** Displays `averageRating: 0.0`, `totalReviews: 0`.
12. **Notification Created for Non-Existent Patient:** Caught by schema validation (`patientId` required).
13. **Marking Notification Read for Another Patient:** Blocked by ownership check (`patientId`).
14. **Queue Paused Notification Trigger:** System dispatches `QUEUE_PAUSED` notification to all `WAITING` patients.
15. **Queue Resumed Notification Trigger:** System dispatches `QUEUE_RESUMED` notification.
16. **Patient Called Notification Trigger:** `staffQueueController.callNextPatient` creates `PATIENT_CALLED` notification.
17. **Empty Review Text:** Saved as `reviewText: null` gracefully.
18. **Profanity in Review Text:** Trimmed and saved safely (moderation hook extensible).
19. **Public Display During Queue Pause:** Displays prominent `QUEUE PAUSED` banner on wall monitor.
20. **Patient Marking All Notifications Read:** Bulk update `isRead: true` for patient.

---

## 21. Phase 11 Boundary & Non-Leakage Rule

Phase 10 strictly MUST NOT implement:
- Payment gateway checkouts (Razorpay/Stripe).
- Third-party paid SMS/WhatsApp API keys.
- Historical queue analytics graphs or CSV exports.
- AI wait predictions.

---

## 22. Test Plan & Acceptance Criteria

### Automated Test Suite: `src/server/utils/validatePhase10.js`
- Test public display endpoint returns anonymous tokens.
- Test rating submission succeeds for `COMPLETED` queue entry.
- Test rating submission fails for `WAITING` or `CANCELLED` entry.
- Test duplicate rating submission returns `HTTP 409 Conflict`.
- Test IDOR protection (Patient A cannot rate Patient B's entry).
- Test doctor `averageRating` and `totalReviews` update atomically.
- Test notification creation on `CALL_NEXT` and queue pause events.
- Execute full Phase 03–09 regression suite.
- Execute Vite client build (`npm run build:client`).

---

## 23. Step-by-Step Implementation Plan

1. **Step 1:** Create `src/server/models/Notification.js`.
2. **Step 2:** Implement `publicQueueController.js` and `GET /api/public/queue/display`.
3. **Step 3:** Implement `ratingController.js` (`POST /api/patient/ratings` & `GET /api/doctors/:id/ratings`).
4. **Step 4:** Implement `notificationController.js` and event dispatches in `staffQueueController.js`.
5. **Step 5:** Add API client functions in `src/client/src/services/api.js`.
6. **Step 6:** Build React components in `src/client/src/App.jsx` (`PublicQueueDisplayBoard`, `RatingSubmissionModal`, `NotificationBell`).
7. **Step 7:** Create automated validation suite `src/server/utils/validatePhase10.js`.
8. **Step 8:** Run validation and full regression suite (Phases 03–10).
9. **Step 9:** Execute client production build (`npm run build:client`).
10. **Step 10:** Read-Only Code Audit & Git Checkpoint.
