package server_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/server"
)

// notFoundHandler stands in for the real Huma mux. Every request that
// reaches it returns 404 — the point of these tests is that CORS headers
// and the OPTIONS short-circuit work BEFORE the request reaches the inner
// handler at all.
var notFoundHandler = http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
	http.NotFound(w, &http.Request{})
})

func TestCORS_Preflight_AllowedOrigin_Returns204WithHeaders(t *testing.T) {
	h := server.CORS([]string{"http://localhost:5173"})(notFoundHandler)
	req := httptest.NewRequest(http.MethodOptions, "/api/auth/signup", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	req.Header.Set("Access-Control-Request-Method", "POST")
	req.Header.Set("Access-Control-Request-Headers", "Content-Type")

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusNoContent, rec.Code,
		"preflight must return 204 even when no operation is registered for OPTIONS")
	require.Equal(t, "http://localhost:5173", rec.Header().Get("Access-Control-Allow-Origin"))
	require.Contains(t, rec.Header().Get("Access-Control-Allow-Methods"), "POST")
	require.Contains(t, rec.Header().Get("Access-Control-Allow-Headers"), "Content-Type")
	require.Equal(t, "true", rec.Header().Get("Access-Control-Allow-Credentials"))
	require.Equal(t, "Origin", rec.Header().Get("Vary"))
}

func TestCORS_Preflight_DisallowedOrigin_Returns204WithoutHeaders(t *testing.T) {
	h := server.CORS([]string{"http://localhost:5173"})(notFoundHandler)
	req := httptest.NewRequest(http.MethodOptions, "/api/auth/signup", nil)
	req.Header.Set("Origin", "https://evil.example.com")

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusNoContent, rec.Code)
	require.Empty(t, rec.Header().Get("Access-Control-Allow-Origin"),
		"disallowed origin must NOT receive an Allow-Origin echo")
}

func TestCORS_ActualRequest_AllowedOrigin_PassesThroughWithHeaders(t *testing.T) {
	innerCalled := false
	inner := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		innerCalled = true
		w.WriteHeader(http.StatusOK)
	})
	h := server.CORS([]string{"http://localhost:5173"})(inner)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/signup", nil)
	req.Header.Set("Origin", "http://localhost:5173")

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	require.True(t, innerCalled, "non-OPTIONS request must reach the inner handler")
	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "http://localhost:5173", rec.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORS_AllowlistNormalizes_TrailingSlash(t *testing.T) {
	// Configured allowlist value has a trailing slash; the browser's Origin
	// header never does. Normalisation at construction time must let them match.
	h := server.CORS([]string{"http://localhost:5173/"})(notFoundHandler)
	req := httptest.NewRequest(http.MethodOptions, "/api/cart/items", nil)
	req.Header.Set("Origin", "http://localhost:5173")

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	require.Equal(t, "http://localhost:5173", rec.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORS_NoOriginHeader_PassesThroughCleanly(t *testing.T) {
	// Same-origin requests (or curl without --header Origin) shouldn't get
	// Allow-Origin headers and shouldn't be rejected.
	innerCalled := false
	inner := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		innerCalled = true
		w.WriteHeader(http.StatusOK)
	})
	h := server.CORS([]string{"http://localhost:5173"})(inner)
	req := httptest.NewRequest(http.MethodGet, "/health", nil)

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	require.True(t, innerCalled)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Empty(t, rec.Header().Get("Access-Control-Allow-Origin"))
}
