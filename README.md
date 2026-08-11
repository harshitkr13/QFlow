# QFlow — Virtual Queue & Appointment Management Platform

## 1. Project Overview

QFlow is a MERN-based virtual queue and appointment management platform designed for clinics and similar service environments.

The core problem:

> Patients should not have to physically wait at a clinic just to know when they will be seen.

QFlow combines:
- online appointment requests,
- walk-in patient registration by clinic staff,
- doctor schedules and breaks,
- live operational queue status,
- estimated waiting/consultation time,
- patient arrival guidance,
- staff-controlled queue operations,
- doctor dashboards,
- clinic administration,
- ratings and operational analytics.

QFlow is **not a medical diagnosis system**. Patients select a doctor specialty/category; QFlow does not diagnose diseases or recommend treatment.

---

## 2. Core Product Principle

**"Don't just book an appointment. Know when you actually need to reach the clinic."**

The patient-facing experience is intentionally divided into three stages:

### Stage 1 — Discover
Patient selects location and specialty, then sees doctors.

Doctor cards show only discovery information:
- name
- photo
- specialty
- rating
- experience
- distance
- consultation fee
- broad availability status

Queue details are hidden.

### Stage 2 — Evaluate
Patient opens a doctor's profile and sees:
- qualification
- experience
- specialty
- clinic information
- fee
- rating/reviews
- weekly availability
- schedule/breaks

Queue details are still hidden.

### Stage 3 — Commit
Only after the patient proceeds toward an appointment/queue action does QFlow reveal operational information:
- current queue status
- currently waiting patients
- current token
- online/walk-in composition
- estimated waiting window
- expected consultation window
- recommended arrival time

---

## 3. Technology Constraints

### Required stack

- React
- JavaScript
- CSS
- Node.js
- Express.js
- MongoDB
- Mongoose

### Explicitly excluded

- AI/ML
- Next.js
- Tailwind
- Redux
- Material UI
- Socket.io
- Redis
- Kafka
- microservices
- unnecessary third-party frameworks/libraries

### Live update strategy for MVP

Use normal HTTP polling from React to the Express API.

Do not introduce WebSockets unless the project requirements are deliberately changed later.

### Authentication

Use secure server-managed authentication/session cookies. Do not expose sensitive authentication data to client-side JavaScript unnecessarily.

---

## 4. User Roles

### Patient
- register/login
- set basic profile information
- select location
- select specialty
- browse doctors
- filter/sort doctors
- view doctor profiles
- view schedule
- proceed to appointment
- see queue information only after proceeding
- join/cancel queue
- track token and estimated arrival time
- check appointment history
- submit verified post-consultation rating

### Doctor
- login
- view today's patients
- see current/next patient
- start consultation
- complete consultation
- view own schedule
- view operational status

Doctor should not be responsible for routine queue administration.

### Receptionist / Compounder / Queue Operator
This is the primary operational user.
- register walk-in patients
- check in online appointments
- call next patient
- skip/no-show a patient
- resume a skipped patient according to policy
- mark doctor busy/unavailable
- set expected resume time
- start/resume queue
- pause queue
- manage today's operational queue

### Clinic Admin
- manage doctors
- manage staff
- configure services/specialties
- configure doctor schedules
- configure breaks
- configure queue policies
- view reports/analytics
- manage clinic settings

### Optional future role: QFlow Super Admin
Only needed if QFlow becomes a multi-clinic SaaS platform.

---

## 5. Online + Walk-in Model

Online and walk-in patients are different entry sources but ultimately become queue entries in the same operational queue.

Sources:
- ONLINE
- WALK_IN
- STAFF_CREATED

Example:

Online:
Patient books through QFlow.

Walk-in:
Patient arrives physically -> receptionist enters patient -> QFlow generates queue entry/token.

The patient does NOT need to have booked online to enter the queue.

Important distinction:
- "Walk-in" means the patient did not pre-book online.
- It does NOT mean the clinic's software is offline.

The MVP assumes the clinic has internet connectivity.

---

## 6. Queue Lifecycle

Typical queue entry:

BOOKED
→ CHECKED_IN
→ WAITING
→ CALLED
→ IN_CONSULTATION
→ COMPLETED

Alternative states:
- CANCELLED
- SKIPPED
- NO_SHOW

A skipped/no-show patient can be reintroduced according to the clinic's queue policy, normally with a new position rather than silently retaining an old position.

---

## 7. Queue Policy

QFlow should support a configurable policy.

Initial recommended policy:

### Hybrid queue
- appointment patients retain their appointment time window;
- walk-ins are inserted according to available capacity;
- urgent/priority entries can be manually assigned by authorized staff;
- exact ordering must be deterministic and auditable.

Possible future policies:
- appointment priority
- strict FIFO
- hybrid

Never silently reorder a patient without a clear business rule.

---

## 8. Doctor Availability

Doctor availability has two separate concepts.

### Recurring schedule
Example:
- Monday: 09:00–13:00, 14:00–18:00
- Tuesday: 09:00–13:00, 14:00–18:00
- Wednesday: OFF
- etc.

### Actual operational status
Examples:
- AVAILABLE
- BUSY
- ON_BREAK
- UNAVAILABLE
- OFFLINE

A receptionist can temporarily mark a doctor unavailable without changing the recurring schedule.

Example:
Scheduled: 09:00–18:00
Actual today: unavailable from 15:00

This distinction must be preserved in the data model.

---

## 9. Waiting-Time Estimate

The first version should use deterministic business logic, not AI.

Inputs may include:
- number of eligible patients ahead
- historical/rolling average consultation duration
- current consultation state
- scheduled break periods
- current doctor availability
- appointment timing
- queue policy

The UI must show an estimate as a range, e.g.:

> Estimated consultation: 04:35–04:45 PM

Never present a queue estimate as guaranteed.

Recommended patient arrival:
> 04:20 PM

Include a disclaimer that actual consultation time may vary.

---

## 10. Important UX Rule

Do NOT show this on the initial doctor list:

- Patients today
- Waiting count
- Current token
- Online/walk-in counts
- Estimated waiting time

These are operational details and should only appear after the patient proceeds toward an appointment/queue action.

---

## 11. Example Doctor Discovery Card

```text
Dr. Ankit Sharma
Cardiologist

4.8 ★
12 Years Experience
2.4 km away
₹800 consultation

[VIEW PROFILE]
```

---

## 12. Example Queue View After Proceeding

```text
Dr. Ankit Sharma
Cardiologist

Currently available

Currently waiting: 6
Currently serving: #20

Estimated wait: 35–45 min
Expected consultation: 04:35–04:45 PM
Recommended arrival: 04:20 PM

[JOIN QUEUE]
```

---

## 13. Core Modules

1. Authentication
2. Patient profile
3. Clinic management
4. Doctor management
5. Specialty/category discovery
6. Doctor search/filter/sort
7. Doctor profile
8. Doctor schedule
9. Appointment management
10. Walk-in registration
11. Queue engine
12. Doctor availability
13. Queue operator dashboard
14. Doctor dashboard
15. Patient queue tracking
16. Ratings/reviews
17. Queue history
18. Analytics

---

## 14. Development Philosophy

Build the business logic first, UI second.

Do not create large numbers of screens before the data model and state transitions are stable.

Every important workflow should have:
- valid state transitions
- role authorization
- server-side validation
- error handling
- auditable history where relevant

---

## 15. Project Completion Definition

QFlow is considered complete only when:
- online and walk-in flows both work;
- queue ordering is deterministic;
- duplicate token generation is prevented;
- doctor schedules and temporary availability work;
- lunch/break periods affect estimates;
- patients only see queue details after proceeding;
- staff can operate the queue without doctor involvement;
- patients can track their token and estimated arrival window;
- invalid role actions are rejected by the backend;
- core flows are tested manually end-to-end;
- production build works.
