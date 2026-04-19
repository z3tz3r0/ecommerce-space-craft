# Makefile — canonical entry point for Phase 0a backend targets.
# Frontend targets are added in Plan 0b.

SHELL := /bin/bash
.DEFAULT_GOAL := help

# Put Go-installed tools (goose, sqlc, etc.) on PATH without requiring shell config.
export PATH := $(shell go env GOPATH)/bin:$(PATH)

.PHONY: help
help:
	@awk 'BEGIN{FS=":.*##"; printf "\nTargets:\n"} /^[a-zA-Z0-9_-]+:.*##/{printf "  %-24s %s\n",$$1,$$2}' $(MAKEFILE_LIST)

# ---------- install / tooling ----------
.PHONY: install
install: install-backend install-frontend ## Install all dependencies

.PHONY: install-backend
install-backend: ## Download Go modules
	cd backend && go mod download

.PHONY: install-frontend
install-frontend: ## Install frontend dependencies with Bun
	cd frontend && bun install

# ---------- dev ----------
.PHONY: dev
dev: ## Run dev servers in parallel
	$(MAKE) -j 2 dev-backend dev-frontend

.PHONY: dev-backend
dev-backend: ## Run the Go API locally (loads backend/.env if present)
	cd backend && \
		if [ -f .env ]; then set -a; . ./.env; set +a; fi && \
		go run ./cmd/api

.PHONY: dev-frontend
dev-frontend: ## Run the Vite dev server
	cd frontend && bun run dev

# ---------- build ----------
.PHONY: build
build: build-backend build-frontend ## Build production binaries and bundles

.PHONY: build-backend
build-backend: ## Build the Go API binary to backend/bin/api
	cd backend && go build -o bin/api ./cmd/api

.PHONY: build-frontend
build-frontend: ## Build the production frontend bundle
	cd frontend && bun run build

# ---------- test ----------
.PHONY: test
test: test-backend test-frontend ## Run all tests

.PHONY: test-backend
test-backend: ## Run Go tests with race detector
	cd backend && go test ./... -race -count=1

.PHONY: test-frontend
test-frontend: ## Run Vitest
	cd frontend && bun run test

# ---------- lint / fmt ----------
.PHONY: lint
lint: lint-backend lint-frontend ## Run all linters

.PHONY: lint-backend
lint-backend: ## Run golangci-lint
	cd backend && golangci-lint run ./...

.PHONY: lint-frontend
lint-frontend: ## Run Biome and Steiger
	cd frontend && bun run lint

.PHONY: typecheck-frontend
typecheck-frontend: ## Run tsc --noEmit on the frontend
	cd frontend && bun run typecheck

.PHONY: fmt
fmt: fmt-backend fmt-frontend ## Format all code

.PHONY: fmt-backend
fmt-backend: ## gofmt + goimports on backend
	cd backend && gofmt -w . && go run golang.org/x/tools/cmd/goimports@latest -w .

.PHONY: fmt-frontend
fmt-frontend: ## Biome format on frontend
	cd frontend && bun run format

# ---------- codegen ----------
.PHONY: codegen
codegen: sqlc-generate openapi-dump codegen-ts ## Regenerate sqlc, OpenAPI, and FE types

.PHONY: sqlc-generate
sqlc-generate: ## Regenerate sqlc Go code from queries.sql
	cd backend && sqlc generate

.PHONY: openapi-dump
openapi-dump: ## Dump Huma's OpenAPI spec to backend/openapi.json
	cd backend && go run ./cmd/openapi > openapi.json

.PHONY: codegen-ts
codegen-ts: ## Regenerate frontend types from backend/openapi.json
	cd frontend && bun run codegen:api

# ---------- migrations ----------
.PHONY: migrate-create
migrate-create: ## goose create a new migration: make migrate-create name=add_foo
	cd backend && goose -dir migrations create $(name) sql

.PHONY: migrate-up
migrate-up: ## Apply all pending migrations
	cd backend && goose -dir migrations postgres "$$DATABASE_URL" up

.PHONY: migrate-down
migrate-down: ## Roll back the most recent migration
	cd backend && goose -dir migrations postgres "$$DATABASE_URL" down

.PHONY: migrate-status
migrate-status: ## Show applied/pending migrations
	cd backend && goose -dir migrations postgres "$$DATABASE_URL" status

.PHONY: migrate-redo
migrate-redo: ## Roll back + reapply the most recent migration (dev only)
	cd backend && goose -dir migrations postgres "$$DATABASE_URL" redo

# ---------- seed ----------
.PHONY: seed
seed: ## Populate products table from backend/data/products.json
	cd backend && go run ./cmd/seed

.PHONY: seed-destroy
seed-destroy: ## TRUNCATE products table
	cd backend && go run ./cmd/seed -d

# ---------- clean ----------
.PHONY: clean
clean: ## Remove build artifacts
	rm -rf backend/bin frontend/dist frontend/node_modules/.vite
