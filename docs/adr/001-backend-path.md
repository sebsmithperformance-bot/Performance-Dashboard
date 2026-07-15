# ADR-001: Backend Path — Aurora PostgreSQL (Data API) + AppSync

- **Status:** Proposed — blocked on AWS account access; spike not yet run
- **Date:** 2026-07-15

## Context

The spec (§2) fixes the primary architecture: Amplify Hosting, Cognito, AppSync GraphQL,
Aurora PostgreSQL Serverless v2 with the RDS Data API, private S3 for imports, Secrets
Manager. The open question is not _which stack_ but _which AppSync-to-Aurora integration
style_ survives the §2.1 verification spike:

1. **Amplify Gen 2 Data SQL integration** (generated) — use only if it supports the full §3
   schema, multi-statement transactions for import commits, authorization rules, and sane
   generated client behavior.
2. **Explicit AppSync resolvers against the Aurora Data API** — the fallback that keeps
   AppSync.
3. **Lambda + API Gateway** — final fallback only if AppSync itself cannot satisfy
   transaction or authorization requirements.

## Spike checklist (§2.1) — all pending

- [ ] Dev Aurora Serverless v2 cluster provisioned with Data API
- [ ] Migration applying `athletes`, `sessions`, `metric_observations`
- [ ] Cognito + AppSync configured
- [ ] React sign-in → create athlete → write observation → read back
- [ ] Multi-statement transaction proven (import commit shape)
- [ ] Unauthenticated request rejected
- [ ] Least-privileged app role (`fh_app_staff`), master user rejected for app code
- [ ] Result recorded here; status flipped to Accepted

## Current blocker

No AWS CLI or credentials exist on this machine, and the AWS account/region/billing owner
decision belongs to the project owner. Everything up to this line (schema migrations,
calculation layer, synthetic generator, tokens, local-only shell) is backend-agnostic and
proceeds; full-page UI wired to a backend does not start until this spike passes.

## Consequences

Choosing Data API + AppSync means no VPC-attached connection pooling concerns, IAM-scoped
DB access via Secrets Manager, and SQL kept in versioned migrations + resolvers. The import
commit path (§4.2 step 9) is the transaction stress test; if the generated integration
cannot express it, we move to explicit resolvers without changing the schema.
