# QFlow Phase 06 — Appointment Booking & Scheduling Design

## 1. Phase Objective

Phase 06 establishes the end-to-end Appointment Booking and Scheduling system for QFlow. It enables patients to query doctor availability for specific dates, view non-overlapping time slots generated dynamically from weekly schedule templates (`DoctorSchedule`), and securely book online appointments. 

Phase 06 also governs the appointment lifecycle (`BOOKED`, `CHECKED_IN`, `CANCELLED`, `COMPLETED`, `NO_SHOW`) and defines the explicit Staff Check-In boundary where a patient's arrival transitions an appointment from `BOOKED` to `CHECKED_IN`.

---

## 2. Scope

- **Slot Generation Engine:** Dynamic calculation of available time slots for a given Doctor, Clinic, and Date using `DoctorSchedule` (working days, shifts, break intervals) and `Doctor.averageConsultationDurationMinutes`.
- **Availability Query Endpoint (`GET /api/doctors/:id/availability`):** Public/Patient endpoint returning available date slots and time intervals without exposing patient identities or queue internal metrics.
- **Appointment Creation Endpoint (`POST /api/appointments`):** Authenticated Patient endpoint creating an `Appointment` with initial status `BOOKED`.
- **Appointment Management Endpoints:**
  - `GET /api/appointments/me` (Patient upcoming & past appointments)
  - `GET /api/appointments/:id` (Patient/Doctor/Staff appointment details)
  - `PATCH /api/appointments/:id/cancel` (Patient/Doctor/Staff appointment cancellation)
  - `PATCH /api/appointments/:id/check-in` (Staff-only arrival check-in transitioning status to `CHECKED_IN`)
- **Concurrency & Double-Booking Prevention:** Unique partial database index preventing simultaneous booking of identical time slots for the same doctor.
- **Stage 3 UX Flow:** Frontend date/slot selection and booking confirmation interface maintaining strict operational blindness (zero live queue tokens or wait times exposed prior to check-in).

---

## 3. Non-Goals

- ❌ **Queue Token Allocation:** Online appointment booking does **NOT** allocate a queue token or number (`BOOKED` appointments receive ZERO tokens).
- ❌ **QueueEntry Creation:** Booking an appointment does **NOT** create a `QueueEntry` record.
- ❌ **QueueCounter Mutations:** Booking an appointment does **NOT** increment `QueueCounter`.
- ❌ **Walk-in Registration:** Walk-in patient registration belongs to Phase 07 (Queue Operations).
- ❌ **Hybrid Queue Ordering & Engine:** Active queue prioritization and call-next operations belong to Phase 07.
- ❌ **Live Queue Metrics:** Real-time queue counters, current token numbers, and live queue wait times are forbidden during Phase 06 booking.
- ❌ **Rating Submission:** Post-consultation rating belongs to Phase 09.

---

## 4. Appointment Lifecycle & State Machine

```text
               ┌─────────────────────────────────────────────────────────┐
               │                                                         │
               ▼                                                         │
       [ Patient Booking ]                                               │
               │                                                         │
               ▼                                                         │
          ( BOOKED ) ───────────────► ( CANCELLED )                      │
               │                            ▲                            │
               │ (Staff Check-In)           │ (Staff/Admin Cancel)       │
               ▼                            │                            │
        ( CHECKED_IN ) ─────────────────────┴────────────────────────────┤
               │                                                         │
               ├───► ( COMPLETED ) (Post-Consultation by Doctor/Staff)   │
               │                                                         │
               └───► ( NO_SHOW )   (Marked if patient misses slot)       │
```

### State Definitions & Governance:

| State | Transition Trigger | Responsible Role | Authorized Actions |
| :--- | :--- | :--- | :--- |
| **`BOOKED`** | Patient selects date & slot (`POST /api/appointments`). | `PATIENT` | Can be viewed by Patient, Doctor, Staff; Can be cancelled by Patient, Doctor, Staff, Admin. |
| **`CHECKED_IN`** | Patient arrives at clinic; Staff verifies arrival (`PATCH /api/appointments/:id/check-in`). | `STAFF` (Assigned Clinic) / `ADMIN` | Marks physical presence at clinic. Triggers Phase 07 `QueueEntry` creation. Patient cannot self-cancel. |
| **`CANCELLED`** | Patient, Staff, Doctor, or Admin cancels appointment (`PATCH /api/appointments/:id/cancel`). | `PATIENT` (before check-in), `STAFF`, `DOCTOR`, `ADMIN` | Releases slot for re-booking. Preserves `cancellationReason` and `cancelledAt`. |
| **`COMPLETED`** | Doctor/Staff finishes consultation. | `DOCTOR`, `STAFF`, `ADMIN` | Final state post-consultation. |
| **`NO_SHOW`** | Staff/Doctor marks patient as absent after shift end or grace period. | `STAFF`, `DOCTOR`, `ADMIN` | Final state for missed appointments. |

---

## 5. Slot Generation Algorithm

When `GET /api/doctors/:id/availability?date=YYYY-MM-DD` is called:

```text
[Input: doctorId, date (YYYY-MM-DD)]
        │
        ▼
1. Fetch Doctor (verify isActive === true & User.isActive === true)
2. Fetch Clinic (verify isActive === true)
3. Fetch active DoctorSchedule for doctorId & clinicId
4. Determine Day of Week (e.g. "2026-08-15" ──► "SATURDAY")
        │
        ▼
5. Is dayOfWeek in DoctorSchedule? & isWorkingDay === true?
   ├── NO ──► Return empty availableSlots [] (Doctor Not Working)
   └── YES ──► Continue
        │
        ▼
6. Retrieve shifts [] and breaks [] for that day
7. Retrieve consultation duration D (Doctor.averageConsultationDurationMinutes, default 15 min)
        │
        ▼
8. Generate Candidate Slots:
   For each shift [shiftStart, shiftEnd]:
     slotStart = shiftStart
     while (slotStart + D <= shiftEnd):
       slotEnd = slotStart + D
       if slotInterval [slotStart, slotEnd] DOES NOT OVERLAP any break interval in breaks []:
         Add { startTime: slotStart, endTime: slotEnd } to candidateSlots []
       slotStart = slotEnd
        │
        ▼
9. Fetch Existing Active Appointments:
   Query Appointment where doctorId = doctorId AND appointmentDate = date AND status IN ['BOOKED', 'CHECKED_IN']
   Collect bookedStartTimes = set of appointment.timeSlot.startTime
        │
        ▼
10. Filter Candidate Slots:
    If date is TODAY (Clinic local date):
      currentTimeStr = Current time "HH:mm" + grace period
      Filter out candidateSlots where startTime <= currentTimeStr
    Filter out candidateSlots where bookedStartTimes.has(candidateSlot.startTime)
        │
        ▼
[Output: availableSlots [], bookedSlotsCount, workingHours, breaks]
```

---

## 6. Patient Booking Rules & Limits

1. **Max Future Bookings Limit:** A single patient can have a maximum of **3 active `BOOKED` appointments** across the platform to prevent slot hoarding.
2. **Duplicate Slot Prevention:** A patient cannot book multiple appointments with the same doctor on the same date.
3. **Same-Day Booking Cutoff:** Same-day booking is allowed up to **30 minutes prior** to the slot's `startTime`.
4. **Advance Booking Window:** Patients can book appointments up to **30 days in advance**. Past dates (`date < today`) are strictly rejected (HTTP 400).
5. **Slot Containment:** Time slots must align strictly with the doctor's configured consultation duration (e.g., 15-minute intervals: 09:00, 09:15, 09:30). Arbitrary user-selected start times (e.g., 09:07) are rejected.
6. **Patient Self-Cancellation Deadline:** Patients can self-cancel a `BOOKED` appointment up to **1 hour before** `startTime`. After check-in or within 1 hour, cancellation requires Staff intervention.

---

## 7. Availability API Contract

### `GET /api/doctors/:id/availability`

#### Query Parameters:
- `date` (required String: `YYYY-MM-DD`): Target appointment date.

#### Response (HTTP 200 OK):
```json
{
  "success": true,
  "doctorId": "64f1a2b3c4d5e6f7a8b9c0d1",
  "doctorName": "Dr. Alice Smith",
  "clinicId": "64f1a2b3c4d5e6f7a8b9c0d2",
  "clinicName": "Discovery Clinic Alpha",
  "date": "2026-08-15",
  "dayOfWeek": "SATURDAY",
  "isWorkingDay": true,
  "consultationDurationMinutes": 15,
  "workingShifts": [
    { "startTime": "09:00", "endTime": "13:00" },
    { "startTime": "14:00", "endTime": "17:00" }
  ],
  "breaks": [
    { "startTime": "13:00", "endTime": "14:00", "label": "Lunch Break" }
  ],
  "availableSlots": [
    { "startTime": "09:00", "endTime": "09:15" },
    { "startTime": "09:15", "endTime": "09:30" },
    { "startTime": "09:30", "endTime": "09:45" },
    { "startTime": "14:00", "endTime": "14:15" }
  ],
  "totalAvailableSlots": 4
}
```

---

## 8. Booking API Contract

### `POST /api/appointments`

#### Request Headers:
- `Authorization: Bearer <patient_jwt_token>`

#### Request Body:
```json
{
  "doctorId": "64f1a2b3c4d5e6f7a8b9c0d1",
  "clinicId": "64f1a2b3c4d5e6f7a8b9c0d2",
  "specialtyId": "64f1a2b3c4d5e6f7a8b9c0d3",
  "appointmentDate": "2026-08-15",
  "timeSlot": {
    "startTime": "09:15",
    "endTime": "09:30"
  }
}
```

#### Response (HTTP 201 Created):
```json
{
  "success": true,
  "message": "Appointment booked successfully",
  "appointment": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d4",
    "clinicId": "64f1a2b3c4d5e6f7a8b9c0d2",
    "doctorId": "64f1a2b3c4d5e6f7a8b9c0d1",
    "patientId": "64f1a2b3c4d5e6f7a8b9c0d5",
    "specialtyId": "64f1a2b3c4d5e6f7a8b9c0d3",
    "appointmentDate": "2026-08-15",
    "timeSlot": {
      "startTime": "09:15",
      "endTime": "09:30"
    },
    "status": "BOOKED",
    "createdAt": "2026-08-12T01:35:00.000Z"
  }
}
```

---

## 9. Appointment Read APIs

1. **`GET /api/appointments/me` (Patient Appointments)**
   - Access: Private (`PATIENT`).
   - Query: `status` (`BOOKED`, `CHECKED_IN`, `COMPLETED`, `CANCELLED`), `type` (`upcoming`, `past`).
   - Resolves patient identity from `req.user.patientId`.

2. **`GET /api/appointments/:id` (Single Appointment Detail)**
   - Access: Private (`PATIENT` owner, `DOCTOR` owner, `STAFF` in same clinic, `ADMIN`).
   - Returns full appointment breakdown.

3. **`GET /api/doctors/me/appointments` (Doctor Appointments)**
   - Access: Private (`DOCTOR`).
   - Query: `date` (`YYYY-MM-DD`), `status`.

4. **`GET /api/staff/appointments` (Staff Clinic Appointments)**
   - Access: Private (`STAFF`).
   - Enforces `Staff.clinicId` scoping.

---

## 10. Cancellation API

### `PATCH /api/appointments/:id/cancel`

#### Request Body (Optional):
```json
{
  "cancellationReason": "Patient requested reschedule"
}
```

#### Transition Rules:
- `PATIENT`: Allowed if status is `BOOKED` and time is $\ge 1$ hour prior to `timeSlot.startTime`.
- `STAFF` / `DOCTOR` / `ADMIN`: Allowed anytime for appointments in their clinic/scope.
- Updates `status = 'CANCELLED'`, `cancelledAt = new Date()`, `cancellationReason`.
- **Slot Release:** The cancelled slot immediately becomes available in `GET /api/doctors/:id/availability`.

---

## 11. Check-In Boundary (Staff Check-In)

### `PATCH /api/appointments/:id/check-in`

#### Access: Private (`STAFF` in same clinic, `ADMIN`)

#### Execution Flow:
1. Verify appointment exists and belongs to Staff's assigned clinic (`Staff.clinicId.equals(appointment.clinicId)`).
2. Verify appointment status is currently `BOOKED`. (If already `CHECKED_IN` or `CANCELLED`, return HTTP 400).
3. Verify appointment date is **TODAY** (`appointmentDate === currentDate`).
4. Update appointment `status = 'CHECKED_IN'` and `checkedInAt = new Date()`.
5. **Phase 07 Handoff:** In Phase 07, this endpoint will trigger `QueueEntry` creation and atomic `QueueCounter` token allocation.

---

## 12. Authorization Matrix

| Endpoint | Method | Public | PATIENT | DOCTOR | STAFF | ADMIN |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `/api/doctors/:id/availability` | `GET` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/api/appointments` | `POST` | ❌ | ✅ (Self) | ❌ | ❌ | ❌ |
| `/api/appointments/me` | `GET` | ❌ | ✅ (Self) | ❌ | ❌ | ❌ |
| `/api/appointments/:id` | `GET` | ❌ | ✅ (Owner) | ✅ (Owner) | ✅ (Clinic) | ✅ |
| `/api/appointments/:id/cancel` | `PATCH` | ❌ | ✅ (Owner) | ✅ (Owner) | ✅ (Clinic) | ✅ |
| `/api/appointments/:id/check-in` | `PATCH` | ❌ | ❌ | ❌ | ✅ (Clinic) | ✅ |
| `/api/doctors/me/appointments` | `GET` | ❌ | ❌ | ✅ (Self) | ❌ | ❌ |
| `/api/staff/appointments` | `GET` | ❌ | ❌ | ❌ | ✅ (Clinic) | ✅ |

---

## 13. Timezone Strategy

- **Date Storage:** ISO Calendar Date string `"YYYY-MM-DD"` (e.g. `"2026-08-15"`).
- **Slot Time Storage:** 24-hour time string `"HH:mm"` (e.g. `"10:30"`).
- **Clinic Local Time Zone:** Default standard `Asia/Kolkata` (IST, UTC+05:30) for date boundary evaluations.
- **Server Determinism:** All date parsing explicitly uses clinic local date boundaries instead of server system clock local offsets.

---

## 14. Concurrency & Double-Booking Strategy

To prevent race conditions where two patients attempt to book the exact same time slot simultaneously:

```text
Patient A (09:15 Request) ──┐
                            ├─► [ MongoDB Engine ] ──► First insert succeeds ──► HTTP 201 Created
Patient B (09:15 Request) ──┘                       └──► Duplicate Key Error ──► HTTP 409 Conflict
                                                         (E11000)
```

### Partial Unique Index Enforcement:
A Partial Unique Index on `Appointment` guarantees zero double-booking at the database engine level:
```javascript
appointmentSchema.index(
  { doctorId: 1, appointmentDate: 1, 'timeSlot.startTime': 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['BOOKED', 'CHECKED_IN'] } },
    name: 'unique_active_doctor_slot_idx'
  }
);
```

---

## 15. Database Indexing & Concurrency Strategy

- **Primary Lookup & Uniqueness:** `unique_active_doctor_slot_idx` on `{ doctorId: 1, appointmentDate: 1, 'timeSlot.startTime': 1 }` (Partial filter for active statuses `['BOOKED', 'CHECKED_IN']`).
- **Patient History Index:** `{ patientId: 1, appointmentDate: -1 }` for fast patient dashboard queries.
- **Doctor Schedule Index:** `{ doctorId: 1, clinicId: 1, isActive: 1 }` for rapid slot generation.

---

## 16. Frontend UX & Stage 3 Decision Boundary

### Stage 3 Booking Decision Flow:

```text
[Doctor Profile View (Stage 2)] ──► Click [PROCEED TO APPOINTMENT]
                                           │
                                           ▼
                             [Appointment Booking View (Stage 3)]
                             ├── 1. Date Selector (Calendar / Chips)
                             ├── 2. Time Slot Grid (Morning / Afternoon Shifts)
                             ├── 3. Booking Summary Card (Doctor, Clinic, Fee, Time)
                             └── 4. Button [CONFIRM APPOINTMENT]
                                           │
                                           ▼
                             [Booking Confirmation Screen]
                             ├── Status: BOOKED
                             ├── Date & Time: Saturday, Aug 15 @ 09:15 AM
                             ├── Instructions: "Please arrive 15 minutes before slot time for Staff Check-in."
                             └── (NO Queue Token or Wait Time Shown)
```

---

## 17. Real-World Edge Cases

| # | Edge Case | Expected Behavior | HTTP Status |
| :--- | :--- | :--- | :---: |
| **1** | Two patients book same slot simultaneously. | First succeeds; second receives 409 Conflict ("Time slot has already been booked"). | `409` |
| **2** | Patient cancels appointment. | Status becomes `CANCELLED`. Slot immediately reappears in availability. | `200` |
| **3** | Patient books a recently cancelled slot. | Slot is available; booking succeeds. | `201` |
| **4** | Doctor schedule changes after appointments exist. | Existing `BOOKED` appointments remain valid. Future availability reflects new schedule. | N/A |
| **5** | Doctor becomes inactive (`User.isActive = false`). | Doctor hidden from discovery and availability; new bookings rejected. | `404` |
| **6** | Doctor goes on `ON_BREAK` or `BUSY`. | Does not cancel future scheduled appointments. Availability search remains open for future slots. | N/A |
| **7** | Patient attempts to book a past date. | Rejected with 400 ("Cannot book appointments for past dates"). | `400` |
| **8** | Patient attempts same-day booking for a past time slot. | Filtered out by slot generation engine; rejected if submitted. | `400` |
| **9** | Patient submits malformed `timeSlot` (e.g. 09:07). | Rejected with 400 ("Invalid time slot alignment"). | `400` |
| **10** | Patient exceeds max future bookings limit (3). | Rejected with 400 ("Maximum active appointments limit reached"). | `400` |
| **11** | Patient double clicks submit button. | First request succeeds; second caught by duplicate index. | `409` |
| **12** | Patient attempts to self-cancel after Staff check-in. | Rejected with 400 ("Checked-in appointments cannot be self-cancelled"). | `400` |
| **13** | Staff checks in appointment for another clinic. | Rejected with 403 ("Staff cannot check in appointments outside assigned clinic"). | `403` |
| **14** | Doctor accesses another doctor's appointments. | Rejected with 403. | `403` |
| **15** | Patient accesses another patient's appointment. | Rejected with 403. | `403` |
| **16** | Schedule contains multiple shifts (e.g. Morning & Evening). | Both shift intervals generate valid time slots correctly. | `200` |
| **17** | Break interval overlaps a potential slot. | Overlapping slots are excluded from candidate slots. | `200` |
| **18** | Consultation duration changes for doctor. | Future slots generated with new duration. Existing booked slot intervals preserved. | `200` |
| **19** | Patient cancels within 1 hour of slot. | Self-cancellation blocked; instructs patient to call clinic staff. | `400` |
| **20** | Clinic is deactivated (`Clinic.isActive = false`). | Availability & booking queries return 404/400. | `404` |
| **21** | Doctor schedule has `isWorkingDay = false` on selected date. | Availability returns empty `availableSlots: []`. | `200` |
| **22** | Invalid ObjectId passed in `doctorId`/`clinicId`/`specialtyId`. | Rejected with 400 ("Invalid ObjectId format"). | `400` |

---

## 18. Security & Validation

- **Identity Resolution:** `patientId` derived strictly from `req.user.patientId`. Client-supplied `patientId` in body is ignored.
- **Role Enforcement:** Booking requires `role === 'PATIENT'`. Check-in requires `role === 'STAFF'` or `ADMIN`.
- **ObjectId Validation:** All URL and body ObjectIds validated prior to database query.

---

## 19. Schema Audit & Required Amendments

### **REQUIRED SCHEMA AMENDMENT:** `src/server/models/Appointment.js`

Current index in `Appointment.js`:
```javascript
appointmentSchema.index(
  { doctorId: 1, appointmentDate: 1, 'timeSlot.startTime': 1, status: 1 },
  { name: 'doctor_date_slot_status_idx' }
);
```

**Issue:** The existing index is non-unique and includes `status` as an index key field, allowing concurrent requests to create duplicate active appointments for the same slot.

**Required Amendment:** Replace with a Partial Unique Index:
```javascript
appointmentSchema.index(
  { doctorId: 1, appointmentDate: 1, 'timeSlot.startTime': 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['BOOKED', 'CHECKED_IN'] } },
    name: 'unique_active_doctor_slot_idx'
  }
);
```

---

## 20. Locked Decisions

- **DECISION 001:** Online appointments receive **ZERO queue tokens** during booking (`BOOKED`). Tokens are allocated ONLY during physical Staff Check-In (`CHECKED_IN`).
- **DECISION 002:** `QueueCounter` entity uses atomic `$inc` updates scoped to `{ clinicId, doctorId, date }`. (Belongs to Phase 07).
- **DECISION 003:** Hybrid queue ordering combines appointments and walk-ins during Phase 07.

---

## 21. Acceptance Criteria

When Phase 06 code implementation begins in the future:
1. `GET /api/doctors/:id/availability` returns valid non-overlapping slots based on `DoctorSchedule`.
2. `POST /api/appointments` creates `BOOKED` appointments and prevents double-booking.
3. `PATCH /api/appointments/:id/cancel` releases slot for re-booking.
4. `PATCH /api/appointments/:id/check-in` updates status to `CHECKED_IN` for staff in same clinic.
5. All 22 edge cases pass automated validation suite (`validatePhase06.js`).
6. Zero QueueTokens or QueueEntries created during booking.

---

## 22. Implementation Sequence (When Instructed to Implement Code)

1. Apply `Appointment.js` partial unique index amendment.
2. Create `src/server/controllers/appointmentController.js`.
3. Create `src/server/routes/appointmentRoutes.js` and mount in `server.js`.
4. Create `src/server/utils/validatePhase06.js` automated test suite.
5. Update React client for Stage 3 booking flow.

---
*Phase 06 Design Document locked and ready for implementation review.*
