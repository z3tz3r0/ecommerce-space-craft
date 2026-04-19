package cart_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/cart"
)

// Service-level tests cover input validation + forwarding to Repository.
// Stock-clamping and stock-overflow checks live in Repository now (atomic
// via SQL transactions) and are exercised by integration tests against
// Postgres rather than mocked here — mocking the clamp would just re-test
// the mock.

func TestService_Get_ReturnsRepoItems(t *testing.T) {
	uid := uuid.New()
	pid := uuid.New()
	want := []cart.Item{{ProductID: pid, Quantity: 2, StockQuantity: 5}}
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		GetItems: func(_ context.Context, _ uuid.UUID) ([]cart.Item, error) {
			return want, nil
		},
	})
	got, err := svc.Get(context.Background(), uid)
	require.NoError(t, err)
	require.Equal(t, want, got.Items)
}

func TestService_Get_NilRepoResult_ReturnsEmptyItems(t *testing.T) {
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		GetItems: func(_ context.Context, _ uuid.UUID) ([]cart.Item, error) {
			return nil, nil
		},
	})
	got, err := svc.Get(context.Background(), uuid.New())
	require.NoError(t, err)
	require.NotNil(t, got.Items, "Items must be a non-nil empty slice for JSON [] vs null safety")
	require.Empty(t, got.Items)
}

func TestService_Get_RepoError_PropagatesWrapped(t *testing.T) {
	boom := errors.New("db exploded")
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		GetItems: func(_ context.Context, _ uuid.UUID) ([]cart.Item, error) {
			return nil, boom
		},
	})
	_, err := svc.Get(context.Background(), uuid.New())
	require.ErrorIs(t, err, boom)
}

func TestService_Add_NonPositiveQuantity_Returns_ErrInvalidQuantity(t *testing.T) {
	cases := []int32{0, -1, -100}
	for _, q := range cases {
		svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
			AddItem: func(context.Context, uuid.UUID, uuid.UUID, int32) (cart.Item, error) {
				t.Fatalf("AddItem must not be called for invalid quantity %d", q)
				return cart.Item{}, nil
			},
		})
		_, err := svc.Add(context.Background(), uuid.New(), uuid.New(), q)
		require.ErrorIs(t, err, cart.ErrInvalidQuantity)
	}
}

func TestService_Add_ForwardsToRepo(t *testing.T) {
	uid := uuid.New()
	pid := uuid.New()
	want := cart.Item{ProductID: pid, Quantity: 3, StockQuantity: 10}
	var capturedDelta int32
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		AddItem: func(_ context.Context, _, _ uuid.UUID, delta int32) (cart.Item, error) {
			capturedDelta = delta
			return want, nil
		},
	})
	got, err := svc.Add(context.Background(), uid, pid, 3)
	require.NoError(t, err)
	require.Equal(t, want, got)
	require.Equal(t, int32(3), capturedDelta)
}

func TestService_Add_RepoError_ProductNotFound_PassesThrough(t *testing.T) {
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		AddItem: func(context.Context, uuid.UUID, uuid.UUID, int32) (cart.Item, error) {
			return cart.Item{}, cart.ErrProductNotFound
		},
	})
	_, err := svc.Add(context.Background(), uuid.New(), uuid.New(), 1)
	require.ErrorIs(t, err, cart.ErrProductNotFound)
}

func TestService_Add_RepoError_OverStock_PassesThrough(t *testing.T) {
	// Repository.AddItem now refuses (ErrOverStock) when there's no
	// headroom — including the stock=0 case that previously produced a
	// quantity=0 cart row. Service must surface that error untouched.
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		AddItem: func(context.Context, uuid.UUID, uuid.UUID, int32) (cart.Item, error) {
			return cart.Item{}, cart.ErrOverStock
		},
	})
	_, err := svc.Add(context.Background(), uuid.New(), uuid.New(), 1)
	require.ErrorIs(t, err, cart.ErrOverStock)
}

func TestService_Set_NonPositiveQuantity_Returns_ErrInvalidQuantity(t *testing.T) {
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		SetItem: func(context.Context, uuid.UUID, uuid.UUID, int32) (cart.Item, error) {
			t.Fatal("SetItem must not be called for invalid quantity")
			return cart.Item{}, nil
		},
	})
	_, err := svc.Set(context.Background(), uuid.New(), uuid.New(), 0)
	require.ErrorIs(t, err, cart.ErrInvalidQuantity)
}

func TestService_Set_ForwardsToRepo(t *testing.T) {
	uid := uuid.New()
	pid := uuid.New()
	want := cart.Item{ProductID: pid, Quantity: 4, StockQuantity: 5}
	var capturedQty int32
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		SetItem: func(_ context.Context, _, _ uuid.UUID, qty int32) (cart.Item, error) {
			capturedQty = qty
			return want, nil
		},
	})
	got, err := svc.Set(context.Background(), uid, pid, 4)
	require.NoError(t, err)
	require.Equal(t, want, got)
	require.Equal(t, int32(4), capturedQty)
}

func TestService_Set_RepoError_OverStock_PassesThrough(t *testing.T) {
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		SetItem: func(context.Context, uuid.UUID, uuid.UUID, int32) (cart.Item, error) {
			return cart.Item{}, cart.ErrOverStock
		},
	})
	_, err := svc.Set(context.Background(), uuid.New(), uuid.New(), 99)
	require.ErrorIs(t, err, cart.ErrOverStock)
}

func TestService_Remove_ForwardsToRepo(t *testing.T) {
	called := false
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		DeleteItem: func(context.Context, uuid.UUID, uuid.UUID) error {
			called = true
			return nil
		},
	})
	require.NoError(t, svc.Remove(context.Background(), uuid.New(), uuid.New()))
	require.True(t, called)
}

func TestService_Merge_ForwardsToRepo_WithItems(t *testing.T) {
	uid := uuid.New()
	pid := uuid.New()
	in := []cart.MergeItem{{ProductID: pid, Quantity: 2}}
	want := cart.Cart{Items: []cart.Item{{ProductID: pid, Quantity: 2, StockQuantity: 5}}}
	var captured []cart.MergeItem
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		MergeItems: func(_ context.Context, _ uuid.UUID, items []cart.MergeItem) (cart.Cart, error) {
			captured = items
			return want, nil
		},
	})
	got, err := svc.Merge(context.Background(), uid, in)
	require.NoError(t, err)
	require.Equal(t, want, got)
	require.Equal(t, in, captured)
}

func TestService_Merge_RepoError_PropagatesWrapped(t *testing.T) {
	boom := errors.New("db exploded")
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		MergeItems: func(context.Context, uuid.UUID, []cart.MergeItem) (cart.Cart, error) {
			return cart.Cart{}, boom
		},
	})
	_, err := svc.Merge(context.Background(), uuid.New(), nil)
	require.ErrorIs(t, err, boom)
}
