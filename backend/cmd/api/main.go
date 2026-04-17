// Command api runs the HTTP server.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/catalog"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/config"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/db"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/logging"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/server"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	logger := logging.New(cfg.Environment, cfg.LogLevel)

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	pool, err := db.New(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("db init failed", "err", err.Error())
		log.Fatalf("db: %v", err)
	}
	defer pool.Close()

	api := server.New("Spacecraft Store API", "0.1.0", logger, cfg.CORSOrigins)

	catalogRepo := catalog.NewPostgres(pool)
	catalogSvc := catalog.NewService(catalogRepo)
	catalog.Register(api.Huma, catalogSvc, logger)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           api.Mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		logger.Info("server listening", "port", cfg.Port, "env", cfg.Environment)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("listen", "err", err.Error())
		}
	}()

	<-ctx.Done()
	logger.Info("shutdown signal received")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("shutdown", "err", err.Error())
	}
}
