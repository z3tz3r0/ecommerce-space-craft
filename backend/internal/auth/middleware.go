package auth

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/session"
)

// userIDKey is the scs session key holding the authenticated user's UUID
// (string-encoded).
const userIDKey = "userID"

// contextKey is the per-request context.Value key for the authenticated User.
type contextKey struct{}

// CurrentUser retrieves the User that RequireAuth attached to the request
// context. Panics if the middleware did not run — callers must only use
// this inside routes registered behind RequireAuth.
func CurrentUser(ctx context.Context) User {
	u, ok := ctx.Value(contextKey{}).(User)
	if !ok {
		panic("auth: CurrentUser called outside RequireAuth-protected handler")
	}
	return u
}

// RequireAuth returns a Huma middleware that rejects unauthenticated
// requests with 401 and attaches the authenticated User to the downstream
// context on success.
func RequireAuth(api huma.API, sess session.Manager, svc *Service, logger *slog.Logger) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		idStr := sess.GetString(ctx.Context(), userIDKey)
		if idStr == "" {
			_ = huma.WriteErr(api, ctx, http.StatusUnauthorized, "not authenticated")
			return
		}
		uid, err := uuid.Parse(idStr)
		if err != nil {
			logger.Warn("auth: malformed session userID", "value", idStr)
			_ = huma.WriteErr(api, ctx, http.StatusUnauthorized, "not authenticated")
			return
		}
		user, err := svc.GetByID(ctx.Context(), uid)
		if err != nil {
			logger.Warn("auth: session user lookup failed", "err", err.Error(), "userID", idStr)
			_ = huma.WriteErr(api, ctx, http.StatusUnauthorized, "not authenticated")
			return
		}
		next(huma.WithValue(ctx, contextKey{}, user))
	}
}
