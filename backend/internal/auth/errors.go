package auth

import (
	"errors"
	"log/slog"

	"github.com/danielgtaylor/huma/v2"
)

// mapError converts a domain error into a Huma-compatible error response.
// Unknown errors are logged and returned as 500.
func mapError(logger *slog.Logger, err error) error {
	switch {
	case errors.Is(err, ErrInvalidCredentials):
		return huma.Error401Unauthorized("invalid email or password")
	case errors.Is(err, ErrEmailTaken):
		return huma.Error409Conflict("email already registered")
	case errors.Is(err, ErrWeakPassword):
		return huma.Error400BadRequest("password must be at least 8 characters")
	case errors.Is(err, ErrNotAuthenticated):
		return huma.Error401Unauthorized("not authenticated")
	case errors.Is(err, ErrUserNotFound):
		return huma.Error404NotFound("user not found")
	default:
		logger.Error("auth: unexpected error", "err", err.Error())
		return huma.Error500InternalServerError("internal error")
	}
}
