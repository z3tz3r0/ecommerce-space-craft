package cart

import (
	"errors"
	"log/slog"

	"github.com/danielgtaylor/huma/v2"
)

// mapError converts a cart domain error to a Huma-compatible response.
func mapError(logger *slog.Logger, err error) error {
	switch {
	case errors.Is(err, ErrProductNotFound):
		return huma.Error404NotFound("product not found or inactive")
	case errors.Is(err, ErrInvalidQuantity):
		return huma.Error400BadRequest("quantity must be >= 1")
	case errors.Is(err, ErrOverStock):
		return huma.Error409Conflict("quantity exceeds available stock")
	default:
		logger.Error("cart: unexpected error", "err", err.Error())
		return huma.Error500InternalServerError("internal error")
	}
}
