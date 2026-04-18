// Package db opens and manages the Postgres connection pool.
package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// New opens a pgx connection pool and pings it. Caller must defer Close().
func New(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("db: parse config: %w", err)
	}
	cfg.MaxConns = 10
	cfg.MinConns = 1
	cfg.MaxConnLifetime = time.Hour
	cfg.MaxConnIdleTime = 30 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("db: new pool: %w", err)
	}

	// Isolate the boot-time ping from the parent signal-aware ctx and give it
	// generous headroom for Neon free-tier cold starts (often 10-20s).
	if err := pingWithRetry(pool, 3, 2*time.Second); err != nil {
		pool.Close()
		return nil, fmt.Errorf("db: ping: %w", err)
	}

	return pool, nil
}

func pingWithRetry(pool *pgxpool.Pool, attempts int, baseDelay time.Duration) error {
	var lastErr error
	for i := 0; i < attempts; i++ {
		pingCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		err := pool.Ping(pingCtx)
		cancel()
		if err == nil {
			return nil
		}
		lastErr = err
		if i < attempts-1 {
			time.Sleep(baseDelay * (1 << i)) // 2s, 4s
		}
	}
	return lastErr
}
