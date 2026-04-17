package catalog

import (
	"errors"
	"log/slog"

	"github.com/danielgtaylor/huma/v2"
)

// mapError converts a domain error to a Huma-compatible error response.
// Unknown errors are logged and returned as 500.
func mapError(logger *slog.Logger, err error) error {
	switch {
	case errors.Is(err, ErrProductNotFound):
		return huma.Error404NotFound("product not found")
	case errors.Is(err, ErrInvalidID):
		return huma.Error400BadRequest("invalid product id")
	default:
		logger.Error("catalog: unexpected error", "err", err.Error())
		return huma.Error500InternalServerError("internal error")
	}
}
