# Spacecraft Store · Documentation Index

> Regenerated 2026-06-13 from a direct code audit. These docs replace an earlier
> auto-scan that mistakenly described a legacy Express + MongoDB + MUI stack
> (removed in commit `65ce0ce`, 2026-04-17). Source of truth for the contract is
> [`backend/openapi.json`](../backend/openapi.json); the canonical project guide
> is [`CLAUDE.md`](../CLAUDE.md).

## What this project is

A spacecraft e-commerce store. Monorepo, two deployables, contract-first: the Go
backend emits an OpenAPI spec, the React frontend's typed client is generated
from it, and CI fails on spec drift.

## Quick reference

| | Backend (`backend/`) | Frontend (`frontend/`) |
|---|---|---|
| Language | Go 1.26 | TypeScript 6, React 19 |
| Framework | Huma v2 (OpenAPI over `net/http`) | Vite 8 + React Router 7 |
| Data | Postgres (Neon) · pgx/v5 + sqlc | TanStack Query v5 + Zustand 5 |
| UI | — | Tailwind v4 + shadcn/ui (Radix + lucide) |
| Auth | scs sessions in Postgres + argon2id | cookie session (`credentials: include`) |
| Architecture | DDD-lite vertical slices | Feature-Sliced Design (Steiger-enforced) |
| Deploy | Render free tier (Docker) | Vercel (static SPA) |

Entry points: [`backend/cmd/api/main.go`](../backend/cmd/api/main.go),
[`frontend/src/app/entrypoint/main.tsx`](../frontend/src/app/entrypoint/main.tsx).

## Generated documentation

- [Project Overview](./project-overview.md)
- [Source Tree Analysis](./source-tree-analysis.md)
- [Development Guide](./development-guide.md)
- [API Contracts · Backend](./api-contracts-backend.md)
- [Data Models · Backend](./data-models-backend.md)
- [State Management · Frontend](./state-management-frontend.md)
- [UI Components · Frontend](./ui-components-frontend.md)

## Existing documentation

- [Root README](../README.md)
- [CLAUDE.md](../CLAUDE.md) · architecture conventions and workflow

## Getting started

See the [Development Guide](./development-guide.md). The short version: install
toolchains, set `backend/.env` and `frontend/.env`, then `make dev`.
