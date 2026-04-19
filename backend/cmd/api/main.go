// Command api runs the HTTP server.
package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
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

// main delegates to run so deferred cleanup (pool.Close, stopSessionCleanup,
// srv.Shutdown) runs before os.Exit. Bare main + log.Fatal would skip those.
func main() {
	os.Exit(run())
}

func run() int {
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "config: %v\n", err)
		return 1
	}

	logger := logging.New(cfg.Environment, cfg.LogLevel)

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	pool, err := db.New(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("db init failed", "err", err.Error())
		return 1
	}
	defer pool.Close()

	api := server.New("Spacecraft Store API", "0.1.0", logger)

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

	// CORS wraps the mux at the http.Handler level so it sees every request
	// — including OPTIONS preflights for endpoints that only register POST/
	// PATCH/DELETE. Putting CORS inside the Huma middleware chain misses
	// preflights because Huma middlewares only fire for registered operations.
	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           server.CORS(cfg.CORSOrigins)(sess.LoadAndSave(api.Mux)),
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

	exitCode := 0
	select {
	case <-ctx.Done():
		logger.Info("shutdown signal received")
	case err := <-serverErrCh:
		// ListenAndServe failed (port in use, bind error, etc.). Without
		// this branch main would block on <-ctx.Done() forever waiting for
		// a SIGINT that wouldn't come.
		logger.Error("server died unexpectedly", "err", err.Error())
		exitCode = 1
	}

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("shutdown", "err", err.Error())
		if exitCode == 0 {
			exitCode = 1
		}
	}

	return exitCode
}
