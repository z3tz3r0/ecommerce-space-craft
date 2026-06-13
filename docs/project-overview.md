# Project Overview · Spacecraft Store

## Executive summary

Spacecraft Store is an e-commerce platform for buying spacecraft, from Fighters
to Capital Ships. It is built contract-first: the Go backend generates an OpenAPI
specification, and the React frontend consumes a fully typed client generated
from that spec. Spec drift is a CI failure on both sides, so the API contract and
the client never silently diverge.

The codebase was rebuilt from an earlier MERN prototype on 2026-04-17 (commit
`65ce0ce`). The current stack is Go + Huma + Postgres on the backend and React 19
+ shadcn/ui + Feature-Sliced Design on the frontend.

## Tech stack

| Category | Backend | Frontend |
|---|---|---|
| Language | Go 1.26 | TypeScript ~6 |
| HTTP / routing | Huma v2 over stdlib `net/http` (`humago` adapter) | React Router 7 |
| Build / runtime | `go build` · Docker (Alpine) | Bun + Vite 8 |
| Data access | sqlc (typed SQL) + pgx/v5 pool | TanStack Query v5 (server), Zustand 5 (guest cart) |
| Database | Postgres (Neon), goose migrations | — |
| UI | — | Tailwind v4 + shadcn/ui (Radix primitives, lucide icons) |
| Forms | Huma input validation | React Hook Form + Zod |
| Auth | `alexedwards/scs` sessions in Postgres (pgxstore) + argon2id | cookie session via `openapi-fetch` (`credentials: include`) |
| Lint / format | golangci-lint, gofmt | Biome, Steiger (FSD) |
| Test | `go test -race` | Vitest + Testing Library |

## Repository structure

Monorepo with two independently deployed parts under `backend/` and `frontend/`,
orchestrated from the root [`Makefile`](../Makefile). See
[Source Tree Analysis](./source-tree-analysis.md).

## Architecture highlights

- **Backend · DDD-lite vertical slices.** Three bounded contexts (`auth`, `cart`,
  `catalog`) under `internal/`, each with `domain → repository → postgres →
  service → handler → errors`. Contexts never import each other. Cross-cutting
  concerns live in `internal/platform/` (config, db, logging, server, session).
- **Frontend · Feature-Sliced Design.** Layers flow downward only
  (`app → pages → widgets → features → entities → shared`), enforced by Steiger.
- **Contract-first codegen loop.** `cmd/openapi` dumps `openapi.json` →
  `openapi-typescript` generates `frontend/src/shared/api/generated/types.ts` →
  `openapi-fetch` gives a typed client. CI gates both artifacts against drift.
- **Hybrid cart.** A guest cart (Zustand + localStorage) and a server cart
  (TanStack Query) sit behind one facade, merged into the account on login.
- **Security baked in.** argon2id hashing, session-fixation defense (token renew
  on login/signup), timing-parity dummy hash to resist email enumeration,
  handler-level CORS so OPTIONS preflights are answered.

## Current state

Phases 0 (foundation), 1 (catalog), and 2 (identity + cart) are implemented and
deployed. Phase 3 (checkout & orders) exists as a design spec only: there is no
order, checkout, or payment context in the backend and no checkout page in the
frontend yet. That is the leading edge of the work.

## Key documentation

- [Source Tree Analysis](./source-tree-analysis.md)
- [Development Guide](./development-guide.md)
- [API Contracts](./api-contracts-backend.md)
- [Data Models](./data-models-backend.md)
- [State Management](./state-management-frontend.md)
- [UI Components](./ui-components-frontend.md)
