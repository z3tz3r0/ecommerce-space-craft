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
install: install-backend ## Install all dependencies (backend in 0a; frontend added in 0b)

.PHONY: install-backend
install-backend: ## Download Go modules
	cd backend && go mod download

# ---------- dev ----------
.PHONY: dev
dev: dev-backend ## Run dev servers (backend only in 0a)

.PHONY: dev-backend
dev-backend: ## Run the Go API locally
	cd backend && go run ./cmd/api

# ---------- build ----------
.PHONY: build
build: build-backend ## Build production binaries

.PHONY: build-backend
build-backend: ## Build the Go API binary to backend/bin/api
	cd backend && go build -o bin/api ./cmd/api

# ---------- test ----------
.PHONY: test
test: test-backend ## Run all tests

.PHONY: test-backend
test-backend: ## Run Go tests with race detector
	cd backend && go test ./... -race -count=1

# ---------- lint / fmt ----------
.PHONY: lint
lint: lint-backend ## Run all linters

.PHONY: lint-backend
lint-backend: ## Run golangci-lint
	cd backend && golangci-lint run ./...

.PHONY: fmt
fmt: fmt-backend ## Format all code

.PHONY: fmt-backend
fmt-backend: ## gofmt + goimports on backend
	cd backend && gofmt -w . && go run golang.org/x/tools/cmd/goimports@latest -w .

# ---------- codegen ----------
.PHONY: codegen
codegen: sqlc-generate openapi-dump ## Regenerate sqlc and OpenAPI artifacts

.PHONY: sqlc-generate
sqlc-generate: ## Regenerate sqlc Go code from queries.sql
	cd backend && sqlc generate

.PHONY: openapi-dump
openapi-dump: ## Dump Huma's OpenAPI spec to backend/openapi.json
	cd backend && go run ./cmd/openapi > openapi.json

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
	rm -rf backend/bin
