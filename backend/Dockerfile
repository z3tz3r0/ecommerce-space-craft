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

# Runtime: distroless/base (includes /bin/sh — required for the chained entrypoint).
# distroless/static does NOT include /bin/sh, which is why we do not use it here.
FROM gcr.io/distroless/base-debian12:nonroot
WORKDIR /app
COPY --from=build /out/api /app/api
COPY --from=goose /go/bin/goose /usr/local/bin/goose
COPY migrations /app/migrations

# On boot: apply pending migrations, then exec the API binary.
ENTRYPOINT ["/bin/sh", "-c", "goose -dir migrations postgres \"$DATABASE_URL\" up && exec /app/api"]
