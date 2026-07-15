# ADR-004: Auth Model and Availability Portal Scope

- **Status:** Proposed — design fixed by spec §7; final acceptance with the spike
- **Date:** 2026-07-15

## Context

Staff need full dashboard access; athletes/managers need exactly one low-friction write
path (daily availability) without accounts.

## Decision

- **Staff:** individual Cognito accounts (no shared logins), TOTP MFA required in
  production, short-lived tokens, app-level inactivity sign-out, refresh-token revocation
  on sign-out. Every staff query/mutation requires a valid Cognito JWT at AppSync.
- **Availability portal:** the only non-Cognito production surface. Passcode → server-side
  verification against a salted Argon2id/bcrypt hash (`availability_gate`) → short-lived
  (~15 min) token scoped to `availability:read_minimal` + `availability:write` only.
  Throttling + lockout on repeated failures. The token can never read GPS, strength,
  profile, import, settings, or historical health data.
- **Database:** application queries run as least-privileged `fh_app_staff` role; master
  user is rejected for application code. Cognito is the API-layer authority; RLS is
  defense-in-depth only and is not claimed to validate Cognito tokens.
- **Environments:** `AUTH_MODE=mock` exists only locally; production builds hard-fail on
  mock auth, disabled availability gate, or dev resource identifiers (§7.3).

## Consequences

Two token audiences exist and must never be interchangeable. Authorization tests (§9.3)
assert the availability token cannot call staff operations, and anonymous requests cannot
reach staff APIs.
