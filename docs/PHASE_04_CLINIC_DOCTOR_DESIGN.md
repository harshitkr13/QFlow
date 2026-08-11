# QFlow Phase 04 — Clinic & Doctor Management Design

## 1. Phase Objective

Phase 04 establishes the administrative and operational management foundation for Clinics, Doctors, Specialties, Doctor Schedules, and Live Operational Availability. 

This phase prepares the backend infrastructure for upcoming patient discovery, doctor search, and appointment booking workflows without implementing patient search UI or booking APIs yet.

---

## 2. Clinic Management

The `Clinic` entity represents physical healthcare facilities hosting consultations and queue operations.

### Roles & Responsibilities:
- **`ADMIN`:** Full administrative control. Creates clinics, updates facility details, configures queue policies (`HYBRID`), updates location coordinates, and deactivates clinics.
- **`PATIENT`:** Read-only access to active clinics (`isActive === true`) for location discovery and facility details.
- **`DOCTOR`:** Read-only access to their assigned clinic details (`Doctor.clinicId`).
- **`STAFF`:** Read-only access to their assigned clinic details (`Staff.clinicId`).

---

## 3. Doctor Management

Doctor onboarding is strictly controlled via administrative workflows. Public self-registration for `DOCTOR` accounts is disabled.

### Onboarding Architecture:
1. `ADMIN` invokes administrative doctor creation endpoint (`POST /api/admin/doctors`).
2. Controller creates `User` account (`role: 'DOCTOR'`, `email`, `password: hashedPassword`).
3. Controller creates `Doctor` profile referencing `user._id`, `clinicId`, `specialtyId`, qualifications, and fees.
4. If profile creation fails, the created `User` record is rolled back cleanly.

---

## 4. Doctor Profile

Doctor profiles combine self-service professional customization with strict administrative credential governance.

### 4.1 Professional Credential Governance
Healthcare platform security requires medical credentials to be verified and managed exclusively by Administrators.

#### Self-Service Doctor Information (Modifiable by `DOCTOR` via `PATCH /api/doctors/me`):
- Biography & profile photo (`photoUrl`)
- Consultation duration estimate (`averageConsultationDurationMinutes`)
- Non-credential personal profile info explicitly permitted

#### Admin-Controlled Verified Information (Immutable by `DOCTOR`, modifiable ONLY by `ADMIN`):
- Verified qualifications & degrees (`qualifications`)
- Specialty assignment (`specialtyId`)
- Assigned clinic (`clinicId`)
- Financial consultation fee (`consultationFee`)
- Verified experience years (`experienceYears`)
- Medical registration / license info
- Account active status (`isActive`)
- Account role (`role: 'DOCTOR'`)
- Aggregate rating metrics (`averageRating`, `totalReviews`)

---

## 5. Staff $\rightarrow$ Doctor Clinic Scoping

For staff-initiated doctor operational status updates (`PATCH /api/staff/doctors/:id/status`), authorization MUST enforce strict clinic boundary checks:

```text
Authenticated STAFF User
        │
        ▼
Resolve Staff Profile: Staff.userId === req.user.id
        │
        ▼
Retrieve Staff.clinicId
        │
        ▼
Fetch Target Doctor: Doctor.findById(id)
        │
        ▼
Check Boundary: Staff.clinicId.equals(Doctor.clinicId)
   ├── If EQUAL ───────────► Allow operational status update
   └── If NOT EQUAL ───────► Return HTTP 403 ("Staff is not authorized to update doctors outside assigned clinic")
```

The client cannot supply or override the clinic scope. Ownership and scoping are derived strictly from server-side database records.

---

## 6. Doctor / Clinic Relationship

### MVP Architectural Constraint: 1 Doctor $\rightarrow$ 1 Primary Clinic
In Phase 04 MVP, each `Doctor` profile belongs to exactly one primary `Clinic` (`Doctor.clinicId`). Multi-clinic operations are out-of-scope for MVP.

---

## 7. Specialty Management

- **`ADMIN`:** Exclusive management (`POST /api/admin/specialties`, `PATCH /api/admin/specialties/:id`).
- **`DOCTOR` / `PATIENT`:** Read-only access to active specialties (`isActive === true`).

---

## 8. Doctor Schedule

`DoctorSchedule` defines weekly recurring working hours, multi-shift intervals, and planned break templates.
- **`DOCTOR`:** Manages own schedule via `PUT /api/doctors/me/schedule`.
- **`ADMIN`:** Can update any doctor's schedule via `PUT /api/admin/doctors/:id/schedule`.
- **`STAFF`:** Read-only access.

---

## 9. Doctor Operational Status

Live operational status (`AVAILABLE`, `BUSY`, `ON_BREAK`, `UNAVAILABLE`, `OFFLINE`) is decoupled from recurring schedules.
- `DOCTOR` updates own status via `PATCH /api/doctors/me/status`.
- `STAFF` updates doctor status via `PATCH /api/staff/doctors/:id/status` (enforcing `Staff.clinicId === Doctor.clinicId`).
- `ADMIN` override via `PATCH /api/admin/doctors/:id/status`.

### UX Metric Visibility Rule (LOCKED):
- **Stage 1 (Discovery) & Stage 2 (Doctor Profile):** Display `operationalStatus` text label (`AVAILABLE`, `ON_BREAK`). Must **NOT** reveal live queue length or active waiting counts.
- **Stage 3 (Booking / Queue Decision):** Reveals live operational queue metrics.

---

## 10. Authorization Matrix

| Action | PATIENT | DOCTOR | STAFF | ADMIN |
| :--- | :---: | :---: | :---: | :---: |
| **View Active Clinics (`GET /api/clinics`)** | ✅ | ✅ | ✅ | ✅ |
| **Create / Update / Deactivate Clinic** | ❌ | ❌ | ❌ | ✅ |
| **View Doctor Profile (`GET /api/doctors/:id`)** | ✅ | ✅ | ✅ | ✅ |
| **Onboard New Doctor (`POST /api/admin/doctors`)** | ❌ | ❌ | ❌ | ✅ |
| **Update Own Bio / Photo (`PATCH /api/doctors/me`)** | ❌ | ✅ (Own) | ❌ | ✅ |
| **Update Doctor Qualifications / Fee / Specialty / Clinic** | ❌ | ❌ | ❌ | ✅ |
| **Manage Specialties (`/api/admin/specialties`)** | ❌ | ❌ | ❌ | ✅ |
| **Manage Own Schedule (`PUT /api/doctors/me/schedule`)** | ❌ | ✅ (Own) | ❌ | ✅ |
| **Update Own Live Status (`PATCH /api/doctors/me/status`)** | ❌ | ✅ (Own) | ❌ | ✅ |
| **Update Doctor Live Status (`PATCH /api/staff/doctors/:id/status`)** | ❌ | ❌ | ✅ (Same Clinic Only) | ✅ |

---

## 11. API Design (Conceptual Endpoints)

### Clinics API:
- `GET /api/clinics` (Public / Protected)
- `GET /api/clinics/:id` (Public / Protected)
- `POST /api/admin/clinics` (Protected: `authorize('ADMIN')`)
- `PATCH /api/admin/clinics/:id` (Protected: `authorize('ADMIN')`)

### Doctors API:
- `GET /api/doctors` (Public / Protected)
- `GET /api/doctors/:id` (Public / Protected)
- `POST /api/admin/doctors` (Protected: `authorize('ADMIN')`)
- `PATCH /api/doctors/me` (Protected: `authorize('DOCTOR')` — Bio/photo/duration only)
- `PATCH /api/admin/doctors/:id` (Protected: `authorize('ADMIN')` — Qualifications/fee/specialty/clinic)

### Specialties API:
- `GET /api/specialties` (Public / Protected)
- `POST /api/admin/specialties` (Protected: `authorize('ADMIN')`)
- `PATCH /api/admin/specialties/:id` (Protected: `authorize('ADMIN')`)

### Doctor Schedule API:
- `GET /api/doctors/:id/schedule` (Public / Protected)
- `PUT /api/doctors/me/schedule` (Protected: `authorize('DOCTOR')`)
- `PUT /api/admin/doctors/:id/schedule` (Protected: `authorize('ADMIN')`)

### Doctor Live Operational Status API:
- `GET /api/doctors/:id/status` (Protected)
- `PATCH /api/doctors/me/status` (Protected: `authorize('DOCTOR')`)
- `PATCH /api/staff/doctors/:id/status` (Protected: `authorize('STAFF', 'ADMIN')` + `Staff.clinicId === Doctor.clinicId`)

---

## 12. Schema Changes Required
- **NO**. All 12 models in `src/server/models/` support this governance without schema modification.

---

## 13. Phase 04 Readiness

### **READY FOR IMPLEMENTATION**

---
*Updated Phase 04 design specification incorporating professional credential governance and staff-doctor clinic scoping.*
