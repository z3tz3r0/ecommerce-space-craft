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

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/auth"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/cart"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/catalog"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/config"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/db"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/logging"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/server"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/session"
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

	sess, stopSessionCleanup := session.New(pool, cfg.Environment == "production")
	defer stopSessionCleanup()

	catalogRepo := catalog.NewPostgres(pool)
	catalogSvc := catalog.NewService(catalogRepo)
	catalog.Register(api.Huma, catalogSvc, logger)

	authRepo := auth.NewPostgres(pool)
	authSvc := auth.NewService(authRepo)
	auth.Register(api.Huma, authSvc, sess, logger)

	cartRepo := cart.NewPostgres(pool)
	cartSvc := cart.NewService(cartRepo)
	cart.Register(api.Huma, cartSvc, authSvc, sess, logger)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           sess.LoadAndSave(api.Mux),
		ReadHeaderTimeout: 5 * time.Second,
	}

	// Buffered so the goroutine can send and exit even if main has already
	// moved on (e.g. SIGINT arrived before ListenAndServe failed).
	serverErrCh := make(chan error, 1)
	go func() {
		logger.Info("server listening", "port", cfg.Port, "env", cfg.Environment)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErrCh <- err
		}
	}()

	select {
	case <-ctx.Done():
		logger.Info("shutdown signal received")
	case err := <-serverErrCh:
		// ListenAndServe failed (port in use, bind error, etc.). Without
		// this branch main would block on <-ctx.Done() forever waiting for
		// a SIGINT that wouldn't come.
		logger.Error("server died unexpectedly", "err", err.Error())
	}

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("shutdown", "err", err.Error())
	}
}
