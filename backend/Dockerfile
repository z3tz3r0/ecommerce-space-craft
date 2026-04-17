# syntax=docker/dockerfile:1.7

FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
ENV CGO_ENABLED=0
RUN go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

FROM golang:1.25-alpine AS goose
RUN go install github.com/pressly/goose/v3/cmd/goose@v3.27.0

# Runtime: Alpine (~8MB) — distroless/base actually ships without /bin/sh, so
# the chained entrypoint (goose up && exec api) needs a shell-bearing base.
FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=build /out/api /app/api
COPY --from=goose /go/bin/goose /usr/local/bin/goose
COPY migrations /app/migrations

# On boot: apply pending migrations, then exec the API binary.
ENTRYPOINT ["/bin/sh", "-c", "goose -dir migrations postgres \"$DATABASE_URL\" up && exec /app/api"]
