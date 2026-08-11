# QFlow Phase 03 — Authentication & Authorization Design

## 1. Authentication Architecture

QFlow employs a stateless, token-based JSON Web Token (JWT) authentication architecture for the MERN stack.

```text
React Client (Vite)
       │
       │ 1. POST /api/auth/login { email, password }
       ▼
Express Auth Controller
       │
       │ 2. Find User & Compare Password (bcryptjs)
       ▼
MongoDB Atlas (User Schema)
       │
       │ 3. Return JWT Token (Payload: id, role)
       ▼
React Client (Stores token in localStorage & attaches HTTP Header)
       │
       │ 4. HTTP Request + Header "Authorization: Bearer <JWT>"
       ▼
Protect Middleware (Verifies signature via JWT_SECRET)
       │
       │ 5. Attach req.user & proceed to Protected Route
       ▼
Authorized Controller Endpoint
```

### Core Authentication Design Principles:
1. **Stateless Token Verification:** The server verifies incoming requests by validating the JWT signature using `process.env.JWT_SECRET` without performing a database lookup on every single request.
2. **Separation of Identity & Authorization:** Authentication answers *"Who is this user?"* (`req.user.id`). Authorization answers *"What is this user allowed to do?"* (`req.user.role` and resource ownership).
3. **Decoupled User Credential Storage:** The `User` model stores authentication credentials (`email`, `password`, `role`, `isActive`). Domain profiles (`Patient`, `Doctor`, `Staff`) reference `User._id` without duplicating authentication fields.

---

## 2. User Account Model Review & Schema Addition Requirement

### User Model Inspection:
Inspection of the Phase 02 `User` model ([src/server/models/User.js](file:///c:/Users/harsh/Desktop/QFlow/project/src/server/models/User.js)) confirms:
- `email`: String, required, unique, lowercase, trimmed.
- `password`: String, required (hashed bcrypt string).
- `role`: String, required, enum `['PATIENT', 'DOCTOR', 'STAFF', 'ADMIN']`.
- `isActive`: Boolean, default `true`.

### Password Hashing Strategy:
Passwords will be hashed using `bcryptjs` with a cost factor of `10` inside authentication services/controllers prior to calling `User.create()`.

### Required Phase 02 Schema Addition (Staff Profile Entity):
To resolve **Staff Clinic Scoping** without violating `User` entity purity (where `User` is strictly authentication identity), a new **`Staff`** domain profile model is required prior to Phase 03 execution:

- **Model Name:** `Staff` ([src/server/models/Staff.js](file:///c:/Users/harsh/Desktop/QFlow/project/src/server/models/Staff.js))
- **Schema Fields:**
  - `_id`: ObjectId
  - `userId`: ObjectId, ref `User`, required, unique
  - `clinicId`: ObjectId, ref `Clinic`, required
  - `fullName`: String, required, trimmed
  - `phone`: String, required, trimmed
  - `timestamps`: `createdAt`, `updatedAt`
- **Reason:** Mirrors the exact architectural pattern used for `Patient` and `Doctor`. Allows clean resolution of `authenticated STAFF user` $\rightarrow$ `Staff profile` $\rightarrow$ `assigned clinicId` without adding clinic fields to `User`.
- **Migration Impact:** Zero impact on existing Phase 01/02 code (no production data created yet).

---

## 3. Registration Rules

Public self-registration is restricted strictly to the **`PATIENT`** role.

### Self-Registration Rules:
- **Allowed Role:** `PATIENT` only.
- **Forbidden Public Roles:** Requests attempting to register with `role` equal to `DOCTOR`, `STAFF`, or `ADMIN` will be rejected immediately with HTTP 400 (`Public self-registration is only allowed for Patients`).
- **Duplicate Email Handling:** Return HTTP 400 (`Email address is already registered`) without leaking internal account details.
- **Input Validation:**
  - `email`: Valid email format, lowercase, trimmed.
  - `password`: Minimum 6 characters.
  - `fullName`: Minimum 2 characters.
  - `phone`: Required 10-digit phone string.

---

## 4. Login Flow

```text
Client Request: POST /api/auth/login { email, password }
       │
       ▼
1. Normalize Input: email = email.toLowerCase().trim()
       │
       ▼
2. Find User: const user = await User.findOne({ email })
   ├── If user NOT found ───────────► Return HTTP 401 ("Invalid email or password")
   └── If user found
       │
       ▼
3. Compare Password: const isMatch = await bcrypt.compare(password, user.password)
   ├── If isMatch === false ────────► Return HTTP 401 ("Invalid email or password")
   └── If isMatch === true
       │
       ▼
4. Check Account Status: if (!user.isActive)
   ├── If user.isActive === false ──► Return HTTP 403 ("Account is inactive or suspended")
   └── If user.isActive === true
       │
       ▼
5. Fetch Profile Reference (patientId / doctorId / staffId + clinicId)
       │
       ▼
6. Issue JWT Token: signToken({ id: user._id, role: user.role })
       │
       ▼
7. Return HTTP 200 JSON Response:
   {
     "success": true,
     "token": "eyJhbGciOiJIUzI1Ni...",
     "user": {
       "id": "60d5ec49f1b2c80015f8e1a1",
       "email": "staff@example.com",
       "role": "STAFF",
       "staffId": "60d5ec49f1b2c80015f8e1a5",
       "clinicId": "60d5ec49f1b2c80015f8e1a6"
     }
   }
```

### Account Enumeration Prevention:
Both non-existent email addresses and incorrect passwords return the identical generic error message: `Invalid email or password` with HTTP status `401 Unauthorized`.

---

## 5. Token / Session Strategy

QFlow uses JSON Web Tokens (JWT) for authentication.

- **Token Type:** Stateless Bearer JWT (`Authorization: Bearer <token>`).
- **Signing Algorithm:** HMAC SHA-256 (`HS256`).
- **Token Payload Structure:**
  ```json
  {
    "id": "60d5ec49f1b2c80015f8e1a1",
    "role": "STAFF",
    "iat": 1786475000,
    "exp": 1786561400
  }
  ```
- **Access Token Lifetime:** `24h` (24 hours).
- **Refresh Token Strategy:** Excluded for MVP. 24-hour JWT tokens provide an optimal balance of user convenience and security for MVP operations.

---

## 6. Token Storage Strategy & Security Trade-offs

### Strategy: `localStorage` with `Authorization: Bearer <token>` Header

- **Client Storage:** The React application stores the JWT string in `localStorage` upon successful login or registration.
- **Request Transport:** Client attaches the token to outgoing API requests via HTTP header:
  `Authorization: Bearer <token>`

### Accurate Security Trade-off Documentation:
- **CSRF Reduction:** Because the JWT is explicitly sent through the `Authorization` header rather than automatically attached by the browser (as with ambient cookies), classic cookie-based Cross-Site Request Forgery (CSRF) attacks are significantly reduced.
- **XSS Exposure:** Storing the JWT in `localStorage` increases exposure to Cross-Site Scripting (XSS) because any JavaScript running on the application origin can access `localStorage`.
- **MVP XSS Mitigation Requirements:**
  1. Strict DOM output sanitization in React (avoiding `dangerouslySetInnerHTML`).
  2. Setting Content Security Policy (CSP) headers on backend responses.
  3. Sanitizing user input strings before rendering.

---

## 7. Authentication Middleware

The `protect` middleware intercepts incoming requests to protected routes:

```javascript
export const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'User account no longer exists' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'User account is suspended' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized, token invalid or expired' });
  }
};
```

---

## 8. Role-Based Authorization & Operational Scope

Role-based access control (RBAC) is enforced by the `authorize` middleware wrapper:

```javascript
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role [${req.user ? req.user.role : 'GUEST'}] is not authorized to access this resource`,
      });
    }
    next();
  };
};
```

### Operational Separation (Doctor vs. Staff Queue Operations):
- **Primary Queue Operator:** **STAFF (Receptionist / Compounder)** is the primary operational queue manager.
- **Doctor Role Focus:** Doctors focus on managing their live operational status (`AVAILABLE`, `BUSY`, `ON_BREAK`, etc.), viewing their room's queue, and conducting consultations. Doctors do **NOT** routinely perform queue administration (`CALL_NEXT`, `SKIP`, `NO_SHOW`, walk-in registration, appointment check-in).

---

## 9. Resource Ownership & Authorization

Role authorization alone is insufficient. Resource ownership checks prevent Insecure Direct Object Reference (IDOR) vulnerabilities.

### Ownership Enforcement Principles:
1. **Patient Ownership:** `PATIENT` can access/modify an `Appointment` or `QueueEntry` ONLY if `resource.patientId` matches their `Patient._id`.
2. **Doctor Ownership:** `DOCTOR` can update `DoctorSchedule` or `Doctor.operationalStatus` ONLY if `resource.doctorId` matches their `Doctor._id`.
3. **Staff Clinic Scoping:** `STAFF` can perform queue operations ONLY if `resource.clinicId` matches their assigned `Staff.clinicId`.
4. **Admin Scope:** `ADMIN` performs administrative oversight across clinics where authorized.

---

## 10. Clinic Scoping

- **Staff Account Association:** Every `STAFF` account is linked to a specific `Clinic` via `Staff.clinicId`.
- **Queue Operation Scoping:** When a staff member invokes queue endpoints (`check-in`, `call-next`, `skip`, `no-show`, `pause-queue`), controller logic verifies:
  `QueueEntry.clinicId.equals(staffProfile.clinicId)`
- **Cross-Clinic Isolation:** Staff from Clinic A are explicitly blocked from viewing, calling, or modifying queues belonging to Clinic B.

---

## 11. Account Status

- **`isActive: true` (ACTIVE):** User can log in, receive JWT tokens, and access protected resources.
- **`isActive: false` (INACTIVE / SUSPENDED):** User is blocked from logging in. Active tokens presented to `protect` middleware return HTTP 403 (`User account is suspended`).

---

## 12. API Endpoint Design

1. **`POST /api/auth/register`** (Public, Patient self-registration + Patient profile creation)
2. **`POST /api/auth/login`** (Public, Email + Password login, returns JWT token + role profile ids)
3. **`GET /api/auth/me`** (Protected, Returns current user details and associated profile)
4. **`POST /api/auth/logout`** (Protected, Client-side token invalidation acknowledgment)

---

## 13. Error Handling

Consistent JSON response format across all authentication/authorization errors:

| HTTP Status | Case | Message |
| :--- | :--- | :--- |
| **400 Bad Request** | Duplicate email / Invalid body | `{ "success": false, "message": "Email address is already registered" }` |
| **401 Unauthorized** | Invalid credentials | `{ "success": false, "message": "Invalid email or password" }` |
| **401 Unauthorized** | Missing/Expired JWT | `{ "success": false, "message": "Not authorized, token invalid or expired" }` |
| **403 Forbidden** | Account suspended | `{ "success": false, "message": "User account is suspended" }` |
| **403 Forbidden** | Insufficient role / Cross-clinic access | `{ "success": false, "message": "Role [DOCTOR] is not authorized to perform queue administration" }` |

---

## 14. Security Considerations

1. **Bcrypt Hashing:** Cost factor 10. Plaintext passwords never stored or logged.
2. **JWT Secret Protection:** `JWT_SECRET` kept strictly in server `.env`.
3. **Account Enumeration Defense:** Generic error messages on login.
4. **IDOR & Scoping Defense:** Explicit checks on `patientId`, `doctorId`, and `staffClinicId`.
5. **XSS Countermeasures:** DOM output sanitization in React frontend to protect `localStorage` JWT.

---

## 15. Patient Registration Flow

Sequential creation of `User` (`role: 'PATIENT'`) and `Patient` profile (`userId: user._id`). If `Patient` creation fails, `User` record is rolled back.

---

## 16. Doctor / Staff / Admin Account Creation

Doctor, Staff, and Admin accounts are created exclusively through authorized `ADMIN` endpoints:
- **`POST /api/admin/doctors`**: Creates `User` (`role: 'DOCTOR'`) + `Doctor` profile.
- **`POST /api/admin/staff`**: Creates `User` (`role: 'STAFF'`) + `Staff` profile (`clinicId`).

---

## 17. Permission Matrix

| Action | PATIENT | DOCTOR | STAFF | ADMIN |
| :--- | :---: | :---: | :---: | :---: |
| **Self-Registration** | ✅ | ❌ | ❌ | ❌ |
| **Login / View Own Account (`GET /me`)** | ✅ | ✅ | ✅ | ✅ |
| **View / Update Own Patient Profile** | ✅ (Own) | ❌ | ❌ | ✅ |
| **Book / Cancel Own Appointment** | ✅ (Own) | ❌ | ❌ | ✅ |
| **View Own Live Queue Token Status** | ✅ (Own) | ❌ | ❌ | ✅ |
| **Submit Post-Consultation Rating** | ✅ (Own) | ❌ | ❌ | ❌ |
| **View / Update Own Doctor Profile** | ❌ | ✅ (Own) | ❌ | ✅ |
| **Manage Own Weekly Schedule (`DoctorSchedule`)** | ❌ | ✅ (Own) | ❌ | ✅ |
| **Update Live Operational Status (`AVAILABLE`, `BUSY`, etc.)** | ❌ | ✅ (Own) | ✅ (Assigned Clinic) | ✅ |
| **View Clinic Live Queue Dashboard** | ❌ | ✅ (Own Room) | ✅ (Assigned Clinic) | ✅ |
| **Call Next Patient (`CALL_NEXT`)** | ❌ | ❌ | ✅ (Assigned Clinic) | ✅ |
| **Start / Complete Consultation** | ❌ | ✅ (Own Room) | ❌ | ✅ |
| **Skip / Mark No-Show Patient** | ❌ | ❌ | ✅ (Assigned Clinic) | ✅ |
| **Register Walk-in Patient (`WALK_IN`)** | ❌ | ❌ | ✅ (Assigned Clinic) | ✅ |
| **Check-in Arrived Appointment Patient** | ❌ | ❌ | ✅ (Assigned Clinic) | ✅ |
| **Pause / Resume Clinic Queue** | ❌ | ❌ | ✅ (Assigned Clinic) | ✅ |
| **Manage Clinic / Doctors / Staff / Specialties** | ❌ | ❌ | ❌ | ✅ |

---

## 18. Design Corrections After Review

Following the architectural audit review, three major design corrections were incorporated:

1. **Staff-Clinic Scoping Resolution:** Adopted Option B (creating a dedicated `Staff` domain model `src/server/models/Staff.js`). This mirrors `Patient` and `Doctor` profile architecture, preserving `User` as pure authentication identity while cleanly scoping staff operations to `Staff.clinicId`.
2. **Doctor vs. Staff Queue Operations Alignment:** Aligned permissions with the core QFlow product decision: *"The Receptionist / Compounder is the primary queue operator."* Doctors are restricted from routine queue administration (`CALL_NEXT`, `SKIP`, `NO_SHOW`, walk-in registration, check-in). Staff handle all queue movement and arrival registration.
3. **Accurate JWT Security Language:** Corrected token security documentation to accurately state that `Authorization: Bearer <token>` headers mitigate CSRF, while `localStorage` increases XSS exposure, establishing DOM sanitization as a mandatory frontend security requirement.

---

## 19. Open Questions

No unresolved authentication/authorization questions.

---

## 20. Implementation Checklist

When instructed to proceed:

- [ ] **Phase 02 Schema Addendum:** Create `src/server/models/Staff.js` (`userId`, `clinicId`, `fullName`, `phone`)
- [ ] **Dependencies to Install:** `jsonwebtoken`, `bcryptjs`
- [ ] **Files to Create:**
  - `src/server/models/Staff.js`
  - `src/server/middleware/authMiddleware.js`
  - `src/server/controllers/authController.js`
  - `src/server/routes/authRoutes.js`
- [ ] **Files to Update:**
  - `src/server/models/index.js` (Export `Staff` model)
  - `src/server/server.js` (Mount auth routes)

---

## 21. Phase 03 Readiness

### **NEEDS SCHEMA/DESIGN CHANGES**
*(Requires creating `Staff` model schema addition prior to Phase 03 auth implementation)*

---
*Design correction complete for QFlow Phase 03 specification.*
