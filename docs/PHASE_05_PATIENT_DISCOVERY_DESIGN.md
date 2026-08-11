# QFlow Phase 05 — Patient Discovery & Doctor Search Design

## 1. Phase Objective

Phase 05 establishes the Patient Discovery and Doctor Search experience for QFlow. It enables patients to discover healthcare providers based on location proximity, medical specialty, professional experience, ratings, and consultation fees, and to inspect comprehensive doctor profile details. 

This phase strictly governs data boundaries across the 3-Stage UX lifecycle without implementing appointment booking, queue creation, token allocation, or rating submission.

---

## 2. Patient Discovery Flow

The patient discovery journey follows a 4-step progressive disclosure model:

```text
[Step 1: Patient Location] ──► [Step 2: Specialty Selection] ──► [Step 3: Discovery Results] ──► [Step 4: Doctor Profile]
(Browser Geo / Manual)         (Cardiology, Ortho, etc.)          (Stage 1 Discovery View)      (Stage 2 Profile View)
                                                                                                        │
                                                                                                        ▼
                                                                                            [PROCEED TO APPOINTMENT]
                                                                                            (Stage 3 Transition Boundary)
```

---

## 3. Location Handling

- **Capture Mechanism:** Patients provide location via browser `navigator.geolocation` or manual city/address lookup.
- **Persistence Policy:** Patient location is used dynamically in search queries (`latitude`, `longitude`). It is stored permanently to `Patient.location` ONLY if an authenticated patient explicitly updates their profile settings. Discovery queries do NOT perform silent DB writes.
- **Privacy Protection:** Precise coordinates are never exposed to other users or logged in server telemetry.
- **Permission Denial Fallback:** If geolocation permission is denied or unavailable, patient discovery falls back to manual city selection or specialty-wide filtering without distance-based sorting.

---

## 4. Specialty Selection

- **Collection-Driven Taxonomy:** Medical categories are fetched dynamically from the `Specialty` collection (`GET /api/specialties`). Specialty names/slugs are NEVER hardcoded in application logic.
- **Active Specialty Filter:** Only active specialties (`Specialty.isActive === true`) are presented to patients.

---

## 5. Gender Considerations

- **Demographic Separation:** `Doctor.gender` (`MALE`, `FEMALE`, `OTHER`) is a demographic filter parameter. `Patient.gender` is a patient demographic attribute. Medical specialties remain completely decoupled from gender rules (zero hardcoded discriminatory assumptions like "Gynecology = Female Only").
- **Optional Filtering:** Patients can optionally filter search results by `doctorGender` (`MALE`, `FEMALE`, `OTHER`).

---

## 6. Doctor Discovery Endpoint (`GET /api/doctors/discover`)

### Query Parameters:
- `specialtyId` (optional ObjectId): Filter by specialty.
- `latitude` (optional Number): Patient latitude for distance calculation.
- `longitude` (optional Number): Patient longitude for distance calculation.
- `radiusKm` (optional Number, default: 25, max: 100): Maximum search radius in kilometers.
- `doctorGender` (optional Enum: `MALE`, `FEMALE`, `OTHER`).
- `minRating` (optional Number: 0.0 to 5.0).
- `minExperience` (optional Number: minimum years of experience).
- `maxFee` (optional Number: maximum consultation fee).
- `sort` (optional Enum: `nearest`, `rating`, `experience`, default: `nearest` if coords provided, else `rating`).
- `page` (default: 1), `limit` (default: 10, max: 50).

---

## 7. Distance Calculation

- **Aggregation Pipeline:** Distance is calculated between the Patient's coordinates and `Clinic.location` using MongoDB `$geoNear` aggregation on the `Clinic` 2dsphere index.
- **Unit Conversion:** MongoDB `$geoNear` returns distance in meters (`distanceMeters`), which is converted to kilometers (`distanceKm = distanceMeters / 1000`) rounded to 1 decimal place.
- **Zero External Map Dependencies:** Calculated 100% natively in MongoDB without external map services (Google Maps, Mapbox, etc.).

---

## 8. Rating Filtering & Sorting

- **Denormalized Storage:** Reads `Doctor.averageRating` and `Doctor.totalReviews`.
- **Tie-Breaking:** Sorting by `rating` uses `averageRating: -1` followed by `totalReviews: -1` as a secondary tie-breaker.
- **Zero-Rating Handling:** Doctors with 0 reviews are included in listings but sorted after rated doctors.

---

## 9. Experience Filtering & Sorting

- **Years of Experience:** Filters by `Doctor.experienceYears >= minExperience`.
- **Experience Sorting:** `sort=experience` orders by `experienceYears: -1`.

---

## 10. Sorting Strategy

| Sort Option | Primary Criteria | Secondary Criteria | Default Radius / Context |
| :--- | :--- | :--- | :--- |
| **`nearest`** | Distance (`distanceMeters: 1`) | `averageRating: -1` | Requires `latitude` & `longitude`. |
| **`rating`** | `averageRating: -1` | `totalReviews: -1` | Global or specialty-filtered. |
| **`experience`** | `experienceYears: -1` | `averageRating: -1` | Global or specialty-filtered. |

---

## 11. Doctor Visibility Rules

A Doctor appears in discovery queries ONLY when all of the following conditions are satisfied:
1. `User.isActive === true` for `Doctor.userId`.
2. Associated `Clinic.isActive === true` for `Doctor.clinicId`.
3. Associated `Specialty.isActive === true` for `Doctor.specialtyId`.

*Note:* `Doctor.operationalStatus` (`AVAILABLE`, `BUSY`, `ON_BREAK`, `UNAVAILABLE`, `OFFLINE`) does **NOT** hide a doctor from discovery. An offline or on-break doctor remains discoverable for profile viewing and schedule inspection.

---

## 12. Clinic Visibility Rules

- Inactive clinics (`Clinic.isActive === false`) are suppressed from discovery.
- Doctors assigned to inactive clinics are automatically hidden from patient search without altering historical database records.

---

## 13. Specialty Visibility Rules

- Inactive specialties (`Specialty.isActive === false`) are hidden from patient category listings.
- Doctors assigned to inactive specialties are suppressed from patient search.

---

## 14. Stage 1 — Discovery Data Boundaries (LOCKED)

### Allowed Fields in Discovery Cards (`GET /api/doctors/discover`):
- Doctor ID & full name (`_id`, `fullName`)
- Profile photo URL (`photoUrl`)
- Specialty name & icon (`specialty`)
- Clinic name, city, & address (`clinic`)
- Distance in km (`distanceKm` — if coordinates supplied)
- Average rating & review count (`averageRating`, `totalReviews`)
- Experience years (`experienceYears`)
- Consultation fee (`consultationFee`)

### STRICTLY FORBIDDEN Fields in Stage 1:
- ❌ Live operational status (`operationalStatus` — e.g. "AVAILABLE", "BUSY", "ON BREAK")
- ❌ Expected resume time (`statusExpectedResumeTime`)
- ❌ Patients waiting count
- ❌ Current serving token
- ❌ Total patients seen today
- ❌ Online vs walk-in patient breakdown
- ❌ Live queue estimated wait time
- ❌ Active token sequence number

---

## 15. Stage 2 — Doctor Profile Data Boundaries (LOCKED)

### Allowed Fields in Doctor Profile (`GET /api/doctors/:id`):
- Full doctor identity, photo, & biography (`fullName`, `photoUrl`, `biography`)
- Qualifications & professional degrees (`qualifications`)
- Specialty details (`specialtyId`)
- Clinic details & location coordinates (`clinicId`)
- Experience years & consultation fee (`experienceYears`, `consultationFee`)
- Average rating & total reviews (`averageRating`, `totalReviews`)
- Recurring weekly working hours (`DoctorSchedule`)
- Estimated consultation duration (`averageConsultationDurationMinutes`)
- Action Button: `[PROCEED TO APPOINTMENT]`

### STRICTLY FORBIDDEN Fields in Stage 2:
- ❌ Live operational status (`operationalStatus`)
- ❌ Expected resume time (`statusExpectedResumeTime`)
- ❌ Live queue waiting list / entry count
- ❌ Current token number being called
- ❌ Total patients registered today
- ❌ Live queue position or estimated wait time

---

## 16. Stage 3 — Appointment Decision Boundary

- Stage 3 is reached ONLY when a patient explicitly clicks `[PROCEED TO APPOINTMENT]` on a Stage 2 profile.
- In Phase 05, Stage 3 is an architectural boundary contract. Operational queue metrics (`waitingCount`, `currentServingToken`, `estimatedWaitMinutes`, `operationalStatus`) will be populated by Phase 06 (Appointment Booking) & Phase 07 (Queue Operations).
- Phase 05 does NOT create appointments, queue entries, or token numbers.

---

## 17. Proceed-to-Appointment Transition

- The `[PROCEED TO APPOINTMENT]` button triggers a client-side route transition (`/doctors/:id/book`).
- Backend endpoint contract: `GET /api/doctors/:id/availability` (Returns available date/shift slots for booking in Phase 06).
- Zero database state mutations (no appointment or queue records created).

---

## 18. Privacy Rules

- Patient search requests do not expose patient identity, contact numbers, or private medical data.
- Aggregated ratings and public clinic addresses are the only public data returned.

---

## 19. API Design

### Public / Patient Endpoints:
- `GET /api/specialties` (List active specialties)
- `GET /api/doctors/discover` (Stage 1 Patient Discovery search)
- `GET /api/doctors/:id` (Stage 2 Comprehensive Doctor Profile & Schedule)

### Administrative / Internal Endpoints:
- `GET /api/doctors` (Basic administrative listing from Phase 04)

---

## 20. Query Performance

- **Indexed Collections:**
  - `Clinic.location`: `2dsphere` index for fast geospatial proximity lookups.
  - `Doctor.clinicId`, `Doctor.specialtyId`: Single & compound indexes for relational joining.
  - `Doctor.averageRating`, `Doctor.experienceYears`: Indexes for sorting.
- **Aggregation Efficiency:** Single MongoDB `$geoNear` aggregation pipeline avoids N+1 queries and in-memory Node.js sorting.

---

## 21. Pagination

- Default `page = 1`, `limit = 10` (max limit = 50).
- Returns metadata: `{ success: true, count, totalCount, totalPages, currentPage, doctors: [...] }`.

---

## 22. Authorization

- `GET /api/doctors/discover` is accessible to both unauthenticated guests and authenticated patients.
- If an authenticated patient calls discovery, optional profile location can be auto-populated if client coordinates are omitted.

---

## 23. Error Handling

- `HTTP 400 Bad Request`: Invalid coordinates, malformed ObjectId, or invalid filter parameters.
- `HTTP 404 Not Found`: Doctor or specialty not found.
- Internal errors pass to global error middleware without leaking database stack traces.

---

## 24. Frontend Architecture (Conceptual UI Flow)

```text
/discover (Search Bar + Category Cards)
    │
    ▼
/doctors (Filter Sidebar + Doctor Result Cards) [Stage 1 Discovery]
    │
    ▼
/doctors/:id (Profile Bio + Schedule Table + "Proceed to Appointment" CTA) [Stage 2 Profile]
    │
    ▼
/doctors/:id/book (Shift Slot Selection) [Stage 3 Decision Transition]
```

Built using standard React + Vanilla CSS (zero external UI framework dependencies).

---

## 25. Schema Review

### **SCHEMA REVIEW RESULT: NO CHANGES REQUIRED**
All required fields (`Clinic.location` 2dsphere, `Doctor.gender`, `Doctor.experienceYears`, `Doctor.averageRating`, `Doctor.consultationFee`, `Specialty.code`, `DoctorSchedule`) exist and are indexed in Mongoose.

---

## 26. Security Review

- **IDOR Protection:** Discovery exposes only public profile information.
- **Inactive Filter Enforcement:** Multi-collection `$lookup` matches `isActive === true` across `User`, `Clinic`, and `Specialty`.
- **Query Injection Prevention:** Mongoose type casting and explicit parameter sanitization.

---

## 27. Open Questions

No unresolved patient discovery design questions.

---

## 28. Implementation Checklist

When instructed to implement Phase 05 code:
- [ ] Add `discoverDoctors` controller function to `src/server/controllers/doctorController.js` (or `src/server/controllers/discoveryController.js`).
- [ ] Mount `GET /api/doctors/discover` route in `src/server/routes/doctorRoutes.js`.
- [ ] Create `src/server/utils/validatePhase05.js` automated test script.
- [ ] Verify regression against Phase 01–04 test suites.

---

## 29. Phase 05 Readiness

### **READY FOR IMPLEMENTATION**

---
*Updated Patient Discovery & Doctor Search design document incorporating strict operational blindness for Stage 1 & Stage 2.*
