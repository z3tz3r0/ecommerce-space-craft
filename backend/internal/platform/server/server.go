// Package server builds the Huma API, registers platform endpoints, and applies middleware.
package server

import (
	"log/slog"
	"net/http"
	"slices"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humago"
	"github.com/google/uuid"
)

// API bundles the Huma API and the underlying http.ServeMux so main.go can
// start an http.Server against it.
type API struct {
	Huma huma.API
	Mux  *http.ServeMux
}

// New creates the API with recover + logging + CORS middleware applied.
func New(title, version string, logger *slog.Logger, corsOrigins []string) *API {
	mux := http.NewServeMux()
	cfg := huma.DefaultConfig(title, version)
	api := humago.New(mux, cfg)

	api.UseMiddleware(recoverMiddleware(api, logger))
	api.UseMiddleware(requestLogMiddleware(logger))
	api.UseMiddleware(corsMiddleware(corsOrigins))

	RegisterHealth(api)

	return &API{Huma: api, Mux: mux}
}

func recoverMiddleware(api huma.API, logger *slog.Logger) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		defer func() {
			if r := recover(); r != nil {
				logger.Error("panic recovered", "value", r, "path", ctx.URL().Path)
				_ = huma.WriteErr(api, ctx, http.StatusInternalServerError, "internal error")
			}
		}()
		next(ctx)
	}
}

func requestLogMiddleware(logger *slog.Logger) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		start := time.Now()
		reqID := uuid.NewString()
		ctx.SetHeader("X-Request-ID", reqID)
		next(ctx)
		logger.Info("request",
			"method", ctx.Method(),
			"path", ctx.URL().Path,
			"status", ctx.Status(),
			"duration_ms", time.Since(start).Milliseconds(),
			"request_id", reqID,
		)
	}
}

func corsMiddleware(allowed []string) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		origin := ctx.Header("Origin")
		if origin != "" && slices.Contains(allowed, origin) {
			ctx.SetHeader("Access-Control-Allow-Origin", origin)
			ctx.SetHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			ctx.SetHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
			ctx.SetHeader("Access-Control-Allow-Credentials", "true")
			ctx.SetHeader("Vary", "Origin")
		}
		if ctx.Method() == http.MethodOptions {
			ctx.SetStatus(http.StatusNoContent)
			return
		}
		next(ctx)
	}
}
