package auth_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alexedwards/scs/v2"
	"github.com/alexedwards/scs/v2/memstore"
	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humago"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/auth"
)

// newTestAPI builds a Huma API with an in-memory session store so tests
// don't need Postgres. Returns the http.Handler wrapping mux + LoadAndSave.
func newTestAPI(t *testing.T, svc *auth.Service) http.Handler {
	t.Helper()
	mux := http.NewServeMux()
	api := humago.New(mux, huma.DefaultConfig("test", "0.0.0"))
	sess := scs.New()
	sess.Store = memstore.New()
	sess.Lifetime = time.Hour
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	auth.Register(api, svc, sess, logger)
	return sess.LoadAndSave(mux)
}

func cookieJar(t *testing.T) http.CookieJar {
	t.Helper()
	jar, err := cookiejar.New(nil)
	require.NoError(t, err)
	return jar
}

func TestHandler_Signup_Success_SetsSessionCookie(t *testing.T) {
	uid := uuid.New()
	now := time.Now()
	svc := auth.NewServiceFake(t, auth.FakeRepoAdapter{
		Create: func(_ context.Context, email, hash string) (auth.FakeRecord, error) {
			return auth.FakeRecord{ID: uid, Email: email, PasswordHash: hash, CreatedAt: now, UpdatedAt: now}, nil
		},
	})
	srv := httptest.NewServer(newTestAPI(t, svc))
	defer srv.Close()

	body := `{"email":"a@b.com","password":"hunter2!!"}`
	resp, err := http.Post(srv.URL+"/api/auth/signup", "application/json", bytes.NewBufferString(body))
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	cookies := resp.Cookies()
	require.NotEmpty(t, cookies, "signup must set a session cookie")
	require.Equal(t, "session", cookies[0].Name)
	require.True(t, cookies[0].HttpOnly)

	var out auth.User
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&out))
	require.Equal(t, uid, out.ID)
	require.Equal(t, "a@b.com", out.Email)
}

func TestHandler_Signup_WeakPassword_Returns422(t *testing.T) {
	svc := auth.NewServiceFake(t, auth.FakeRepoAdapter{})
	srv := httptest.NewServer(newTestAPI(t, svc))
	defer srv.Close()

	// Huma's minLength:"8" rejects short passwords at schema validation
	// before the service runs, so the status is 422 (Huma default for
	// request validation failures).
	body := `{"email":"a@b.com","password":"short"}`
	resp, err := http.Post(srv.URL+"/api/auth/signup", "application/json", bytes.NewBufferString(body))
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
}

func TestHandler_Login_WrongPassword_Returns401(t *testing.T) {
	svc := auth.NewServiceFake(t, auth.FakeRepoAdapter{
		GetByEmail: func(_ context.Context, _ string) (auth.FakeRecord, error) {
			return auth.FakeRecord{}, auth.ErrUserNotFound
		},
	})
	srv := httptest.NewServer(newTestAPI(t, svc))
	defer srv.Close()

	body := `{"email":"nobody@x.com","password":"hunter2!!"}`
	resp, err := http.Post(srv.URL+"/api/auth/login", "application/json", bytes.NewBufferString(body))
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestHandler_Me_NoCookie_Returns401(t *testing.T) {
	svc := auth.NewServiceFake(t, auth.FakeRepoAdapter{})
	srv := httptest.NewServer(newTestAPI(t, svc))
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/auth/me")
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestHandler_SignupThenMe_ReturnsUserWithCookie(t *testing.T) {
	uid := uuid.New()
	now := time.Now()
	svc := auth.NewServiceFake(t, auth.FakeRepoAdapter{
		Create: func(_ context.Context, email, hash string) (auth.FakeRecord, error) {
			return auth.FakeRecord{ID: uid, Email: email, PasswordHash: hash, CreatedAt: now, UpdatedAt: now}, nil
		},
		GetByID: func(_ context.Context, id uuid.UUID) (auth.FakeRecord, error) {
			if id == uid {
				return auth.FakeRecord{ID: uid, Email: "a@b.com", CreatedAt: now, UpdatedAt: now}, nil
			}
			return auth.FakeRecord{}, auth.ErrUserNotFound
		},
	})
	srv := httptest.NewServer(newTestAPI(t, svc))
	defer srv.Close()

	client := &http.Client{Jar: cookieJar(t)}

	// Signup — captures session cookie into the jar.
	{
		body := `{"email":"a@b.com","password":"hunter2!!"}`
		resp, err := client.Post(srv.URL+"/api/auth/signup", "application/json", bytes.NewBufferString(body))
		require.NoError(t, err)
		resp.Body.Close()
		require.Equal(t, http.StatusCreated, resp.StatusCode)
	}

	// Me — cookie jar replays the session cookie.
	{
		resp, err := client.Get(srv.URL + "/api/auth/me")
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var out auth.User
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&out))
		require.Equal(t, uid, out.ID)
	}
}

func TestHandler_Logout_ClearsSession(t *testing.T) {
	uid := uuid.New()
	now := time.Now()
	svc := auth.NewServiceFake(t, auth.FakeRepoAdapter{
		Create: func(_ context.Context, email, hash string) (auth.FakeRecord, error) {
			return auth.FakeRecord{ID: uid, Email: email, PasswordHash: hash, CreatedAt: now, UpdatedAt: now}, nil
		},
		GetByID: func(_ context.Context, _ uuid.UUID) (auth.FakeRecord, error) {
			return auth.FakeRecord{ID: uid, Email: "a@b.com", CreatedAt: now, UpdatedAt: now}, nil
		},
	})
	srv := httptest.NewServer(newTestAPI(t, svc))
	defer srv.Close()

	client := &http.Client{Jar: cookieJar(t)}

	body := `{"email":"a@b.com","password":"hunter2!!"}`
	resp, err := client.Post(srv.URL+"/api/auth/signup", "application/json", bytes.NewBufferString(body))
	require.NoError(t, err)
	resp.Body.Close()

	// Logout
	resp, err = client.Post(srv.URL+"/api/auth/logout", "application/json", nil)
	require.NoError(t, err)
	resp.Body.Close()
	require.Equal(t, http.StatusNoContent, resp.StatusCode)

	// Me should now 401
	resp, err = client.Get(srv.URL + "/api/auth/me")
	require.NoError(t, err)
	resp.Body.Close()
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}
