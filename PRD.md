# QFlow — Product Requirements Document

## 1. Product Vision

Create a clinic queue and appointment system that reduces unnecessary physical waiting and gives clinic staff a simple operational control panel.

## 2. Problem Statement

Current clinic workflows often split information across:
- phone calls,
- reception registers,
- physical tokens,
- WhatsApp messages,
- appointment books,
- verbal doctor availability updates.

Patients may arrive too early, wait too long, or miss their turn.

QFlow creates one operational source of truth.

## 3. Goals

### Primary goals
1. Allow patients to discover doctors by location and specialty.
2. Allow patients to compare doctors without exposing unnecessary operational queue data.
3. Reveal queue information when the patient proceeds toward an appointment.
4. Support both online appointments and walk-in patients.
5. Allow receptionists/compounders to operate the queue.
6. Track doctor schedules, breaks and temporary availability.
7. Estimate waiting and arrival windows.
8. Provide transparent queue status.
9. Preserve a history of queue events.

### Non-goals
- medical diagnosis
- treatment recommendation
- prescription generation
- AI doctor recommendation
- emergency triage
- real-time medical monitoring
- payment processing in MVP

---

## 4. Personas

### Patient
Wants:
- nearby suitable doctors
- trusted profile information
- clear fees
- convenient timing
- minimum waiting
- confidence that arriving at the clinic at the suggested time will not cause them to miss their turn

### Receptionist / Compounder
Wants:
- quick patient entry
- easy queue control
- ability to manage walk-ins
- ability to pause/resume a doctor
- visibility into today's queue

### Doctor
Wants:
- minimal administrative work
- current patient
- next patient
- daily patient count
- simple consultation state control

### Clinic Admin
Wants:
- staff/doctor configuration
- schedule management
- queue policy
- reports
- operational visibility

---

## 5. Functional Requirements

### FR-01 Authentication
- patient registration/login
- staff login
- doctor login
- admin login
- role-based authorization
- logout
- secure session handling

### FR-02 Patient Profile
Fields:
- name
- phone
- email
- date of birth/age
- gender
- location

Gender must not be used to incorrectly block access to medical specialties. Optional doctor-gender preference can be offered.

### FR-03 Location
Patient can:
- enter/select location
- use current location only if browser permission is available
- change search location

Clinic locations are stored with latitude/longitude for distance calculation.

### FR-04 Specialty Selection
Examples:
- Neurologist
- Cardiologist
- Orthopedist
- Psychiatrist
- Gynecologist
- Dermatologist
- Ophthalmologist
- ENT
- Pediatrician
- General Physician
- Other

QFlow does not diagnose the patient.

### FR-05 Doctor Discovery
Doctor list can be filtered/sorted by:
- distance
- rating
- experience
- fee
- availability
- waiting time only after the patient proceeds to queue/appointment context

Initial list must NOT expose queue counts.

### FR-06 Doctor Profile
Show:
- name
- photo
- specialty
- qualifications
- experience
- rating
- clinic
- location/distance
- fee
- weekly schedule
- break schedule
- broad availability status

### FR-07 Appointment & Token Allocation
Patient can:
- select doctor
- choose available date/time window
- proceed to booking (creates `Appointment` record in `BOOKED` state; does NOT assign queue token yet)
- cancel within allowed rules
- check in upon arriving at the clinic (creates `QueueEntry` and allocates an atomic operational queue token)

### FR-08 Walk-in
Staff can:
- search/create patient
- select doctor
- select service
- assign priority if authorized
- create `QueueEntry` directly
- generate operational queue token atomically via `QueueCounter`

### FR-09 Queue Engine & Lifecycle
Support operational state machine:
- `BOOKED` (Appointment created, no token)
- `CHECKED_IN` / `WAITING` (QueueEntry created, token assigned)
- `CALLED`
- `IN_CONSULTATION`
- `COMPLETED`
- `SKIPPED`
- `NO_SHOW`
- `CANCELLED`
- `REJOIN` (assigns valid new queue position/token according to policy)

Queue Engine uses a **HYBRID** ordering policy that deterministically merges online appointment windows and walk-in entries based on check-in time, appointment window, doctor availability, breaks, and existing active queue state without arbitrarily reordering actively waiting patients.

### FR-10 Doctor Availability
Support:
- recurring schedule
- break/lunch
- off days
- temporary busy
- temporary unavailable
- expected resume time
- resume queue

### FR-11 Queue Estimate
System calculates:
- current waiting count
- patients ahead
- estimated waiting range
- expected consultation window
- recommended arrival time

### FR-12 Patient Tracking
Patient can see:
- own token (after check-in) or appointment window (prior to check-in)
- current token
- approximate position
- estimate
- doctor status
- schedule interruptions
- queue changes

### FR-13 Ratings
Only completed/verified consultations may create a rating.

### FR-14 Analytics
Admin can see:
- patients today
- online vs walk-in
- completed
- cancelled
- no-show
- average waiting
- average consultation
- doctor-level statistics

---

## 6. Business Rules

### BR-01 Key Entity Distinctions
- **Appointment:** A planned reservation for a doctor/date/time. Does NOT occupy an active queue position or hold a token.
- **QueueEntry:** An active operational patient position in today's queue.
- **QueueCounter:** The atomic mechanism scoped to `{ clinicId, doctorId, date }` that allocates operational token numbers.

### BR-02 Token Allocation Timing
- Online appointments do NOT receive a queue token at booking time.
- Token allocation occurs ONLY when an online patient checks in at the clinic (`CHECKED_IN` -> `QueueEntry` created -> Token allocated) or when staff registers a walk-in patient.

### BR-03 Atomic Token Uniqueness & QueueCounter
- Token numbers MUST be generated atomically via `QueueCounter` and MUST be unique within the `{ clinicId, doctorId, date }` scope.
- Concurrent staff submissions (e.g., two receptionists registering walk-ins simultaneously) must be safely handled so that duplicate tokens are never issued.

### BR-04 Hybrid Queue Policy
- The queue engine MUST implement the **HYBRID** policy.
- Online appointments represent target arrival/consultation windows; walk-ins represent real-time physical arrivals.
- Ordering calculation considers appointment slot, check-in timestamp, queue position, doctor breaks, and average service duration.
- Once a patient is actively waiting or in consultation, they must NOT be arbitrarily reordered merely because another patient has a later appointment.

### BR-05 Server authority
Queue state is controlled by the backend, not by React.

### BR-06 Role authority
Frontend hiding is not authorization. Every protected action must be checked server-side.

### BR-07 Queue estimate
Estimates are advisory, not guaranteed.

### BR-08 Doctor break
A break pauses new operational service for that doctor and affects estimated times.

### BR-09 Temporary unavailability
Temporary unavailability must not destroy the recurring schedule.

### BR-10 No-show
A no-show patient does not automatically retain the same position.

### BR-11 Rating
Only verified completed consultations can be rated.

### BR-12 Queue visibility
Operational queue details are hidden from doctor discovery cards and general profile pages until the patient enters the appointment/queue decision flow.

---

## 7. Success Metrics

For a prototype:
- successful registration/login
- successful doctor discovery
- successful online booking (Appointment created)
- successful check-in and atomic token allocation (QueueEntry created)
- successful walk-in entry
- successful deterministic hybrid queue progression
- correct token generation via QueueCounter
- correct availability handling
- useful estimated arrival window

Operational metrics:
- average waiting time
- average consultation time
- no-show rate
- online/walk-in ratio
- daily patient volume

---

## 8. MVP Acceptance Scenario

A patient:
1. registers;
2. logs in;
3. selects location;
4. selects Cardiologist;
5. filters by rating/distance/experience;
6. opens doctor profile;
7. sees qualification/schedule;
8. proceeds to appointment;
9. now sees queue status;
10. books appointment slot (receives Appointment confirmation, no token yet);
11. arrives at clinic and checks in;
12. system creates QueueEntry, atomically allocates token, and displays estimated wait/arrival time.

At the same time:
1. a walk-in patient arrives;
2. receptionist adds the patient;
3. system atomically allocates the next valid token via QueueCounter;
4. hybrid queue updates deterministically;
5. patient estimate adjusts.

Then:
1. doctor goes on lunch;
2. receptionist records the break;
3. queue remains intact;
4. estimates shift;
5. doctor resumes;
6. queue continues.

This scenario is the core product acceptance test.
