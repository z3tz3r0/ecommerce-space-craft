// Package session wires the HTTP session manager used for cookie-based auth.
//
// The manager wraps alexedwards/scs with a pgxstore adapter so session state
// lives in the existing Neon Postgres pool — no additional services required.
package session

import (
	"net/http"
	"time"

	"github.com/alexedwards/scs/pgxstore"
	"github.com/alexedwards/scs/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Manager is a thin alias so callers depend on `session.Manager` rather than
// the scs type directly.
type Manager = *scs.SessionManager

// New returns a configured scs.SessionManager backed by pgxstore plus a
// cleanup function the caller MUST invoke during graceful shutdown.
//
// pgxstore.New starts a background goroutine that periodically deletes
// expired sessions from Postgres; the returned cleanup func calls
// store.StopCleanup() so that goroutine exits cleanly when the server does.
//
// `secureCookie` controls cross-site cookie behaviour:
//
//   - true  → production: Secure=true + SameSite=None. Required for the
//     Vercel frontend (vercel.app) to send the cookie on cross-site fetches
//     to the Render backend (onrender.com). SameSite=Lax would silently
//     drop the cookie on every cross-site XHR, breaking every authenticated
//     endpoint in production.
//   - false → local dev: Secure=false + SameSite=Lax. localhost:5173↔
//     localhost:8080 is same-site, so Lax suffices, and SameSite=None
//     requires Secure (browsers reject None-without-Secure).
func New(pool *pgxpool.Pool, secureCookie bool) (Manager, func()) {
	store := pgxstore.New(pool)
	s := scs.New()
	s.Store = store
	s.Lifetime = 30 * 24 * time.Hour   // 30-day absolute session lifetime
	s.IdleTimeout = 7 * 24 * time.Hour // 7-day inactivity window (rolling)
	s.Cookie.Name = "session"
	s.Cookie.Path = "/"
	s.Cookie.HttpOnly = true
	s.Cookie.Secure = secureCookie
	if secureCookie {
		s.Cookie.SameSite = http.SameSiteNoneMode
	} else {
		s.Cookie.SameSite = http.SameSiteLaxMode
	}
	return s, store.StopCleanup
}
