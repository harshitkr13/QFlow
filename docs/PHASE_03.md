# Phase 03 — Authentication & Roles

## Goal
Implement secure role-aware authentication.

## Roles
- PATIENT
- DOCTOR
- STAFF
- ADMIN

## Acceptance Criteria
- registration works for patient
- login works
- protected endpoints reject unauthenticated requests
- role-restricted endpoints reject unauthorized roles
- logout invalidates the authenticated session
