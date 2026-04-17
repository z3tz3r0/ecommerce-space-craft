// Package logging builds a slog.Logger for the application.
package logging

import (
	"log/slog"
	"os"
)

// New returns a slog.Logger. environment "dev" uses a text handler; any other
// value uses JSON. Level is applied to the handler.
func New(environment string, level slog.Level) *slog.Logger {
	opts := &slog.HandlerOptions{Level: level}
	var h slog.Handler
	if environment == "dev" {
		h = slog.NewTextHandler(os.Stdout, opts)
	} else {
		h = slog.NewJSONHandler(os.Stdout, opts)
	}
	return slog.New(h)
}
