package cart_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
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
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/cart"
)

// buildTestServer wires an in-memory session store + fake auth svc + fake
// cart svc behind a real httptest server so cookies and middleware flow
// exactly as they do in cmd/api.
func buildTestServer(t *testing.T, authSvc *auth.Service, cartSvc *cart.Service) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	api := humago.New(mux, huma.DefaultConfig("test", "0.0.0"))
	sess := scs.New()
	sess.Store = memstore.New()
	sess.Lifetime = time.Hour
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	auth.Register(api, authSvc, sess, logger)
	cart.Register(api, cartSvc, authSvc, sess, logger)
	return httptest.NewServer(sess.LoadAndSave(mux))
}

func newClient(t *testing.T) *http.Client {
	t.Helper()
	jar, err := cookiejar.New(nil)
	require.NoError(t, err)
	return &http.Client{Jar: jar}
}

func signupAndAuthenticate(t *testing.T, client *http.Client, baseURL string) {
	t.Helper()
	body := `{"email":"a@b.com","password":"hunter2!!"}`
	resp, err := client.Post(baseURL+"/api/auth/signup", "application/json", bytes.NewBufferString(body))
	require.NoError(t, err)
	resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)
}

func TestHandler_GetCart_NoSession_Returns401(t *testing.T) {
	authSvc := auth.NewServiceFake(t, auth.FakeRepoAdapter{})
	cartSvc := cart.NewServiceFake(t, cart.FakeRepoAdapter{})
	srv := buildTestServer(t, authSvc, cartSvc)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/cart")
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestHandler_GetCart_WithSession_ReturnsEmptyItems(t *testing.T) {
	uid := uuid.New()
	now := time.Now()
	authSvc := auth.NewServiceFake(t, auth.FakeRepoAdapter{
		Create: func(_ context.Context, email, hash string) (auth.FakeRecord, error) {
			return auth.FakeRecord{ID: uid, Email: email, PasswordHash: hash, CreatedAt: now, UpdatedAt: now}, nil
		},
		GetByID: func(_ context.Context, _ uuid.UUID) (auth.FakeRecord, error) {
			return auth.FakeRecord{ID: uid, Email: "a@b.com", CreatedAt: now, UpdatedAt: now}, nil
		},
	})
	cartSvc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		GetItems: func(_ context.Context, _ uuid.UUID) ([]cart.Item, error) {
			return nil, nil
		},
	})
	srv := buildTestServer(t, authSvc, cartSvc)
	defer srv.Close()

	client := newClient(t)
	signupAndAuthenticate(t, client, srv.URL)

	resp, err := client.Get(srv.URL + "/api/cart")
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var out cart.Cart
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&out))
	require.Empty(t, out.Items)
}

func TestHandler_AddItem_WithSession_ReturnsItem(t *testing.T) {
	uid := uuid.New()
	pid := uuid.New()
	now := time.Now()
	authSvc := auth.NewServiceFake(t, auth.FakeRepoAdapter{
		Create: func(_ context.Context, email, hash string) (auth.FakeRecord, error) {
			return auth.FakeRecord{ID: uid, Email: email, PasswordHash: hash, CreatedAt: now, UpdatedAt: now}, nil
		},
		GetByID: func(_ context.Context, _ uuid.UUID) (auth.FakeRecord, error) {
			return auth.FakeRecord{ID: uid, Email: "a@b.com", CreatedAt: now, UpdatedAt: now}, nil
		},
	})
	cartSvc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		GetProduct: func(_ context.Context, _ uuid.UUID) (cart.FakeProduct, error) {
			return cart.FakeProduct{ID: pid, Name: "X-Wing", PriceCents: 12500000, StockQuantity: 10, IsActive: true}, nil
		},
		GetItemQuantity: func(_ context.Context, _, _ uuid.UUID) (int32, error) {
			return 0, nil
		},
		UpsertItem: func(_ context.Context, _, _ uuid.UUID, _ int32) error {
			return nil
		},
	})
	srv := buildTestServer(t, authSvc, cartSvc)
	defer srv.Close()

	client := newClient(t)
	signupAndAuthenticate(t, client, srv.URL)

	body := fmt.Sprintf(`{"productId":%q,"quantity":2}`, pid.String())
	resp, err := client.Post(srv.URL+"/api/cart/items", "application/json", bytes.NewBufferString(body))
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var out cart.Item
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&out))
	require.Equal(t, pid, out.ProductID)
	require.Equal(t, int32(2), out.Quantity)
}

func TestHandler_DeleteItem_WithSession_Returns204(t *testing.T) {
	uid := uuid.New()
	pid := uuid.New()
	now := time.Now()
	authSvc := auth.NewServiceFake(t, auth.FakeRepoAdapter{
		Create: func(_ context.Context, email, hash string) (auth.FakeRecord, error) {
			return auth.FakeRecord{ID: uid, Email: email, PasswordHash: hash, CreatedAt: now, UpdatedAt: now}, nil
		},
		GetByID: func(_ context.Context, _ uuid.UUID) (auth.FakeRecord, error) {
			return auth.FakeRecord{ID: uid, Email: "a@b.com", CreatedAt: now, UpdatedAt: now}, nil
		},
	})
	cartSvc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		DeleteItem: func(_ context.Context, _, _ uuid.UUID) error {
			return nil
		},
	})
	srv := buildTestServer(t, authSvc, cartSvc)
	defer srv.Close()

	client := newClient(t)
	signupAndAuthenticate(t, client, srv.URL)

	req, err := http.NewRequest(http.MethodDelete, srv.URL+"/api/cart/items/"+pid.String(), nil)
	require.NoError(t, err)
	resp, err := client.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusNoContent, resp.StatusCode)
}
