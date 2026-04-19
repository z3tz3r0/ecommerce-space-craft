package cart_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/cart"
)

func TestService_Get_Empty_ReturnsEmptyItems(t *testing.T) {
	uid := uuid.New()
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		GetItems: func(_ context.Context, _ uuid.UUID) ([]cart.Item, error) {
			return nil, nil
		},
	})
	got, err := svc.Get(context.Background(), uid)
	require.NoError(t, err)
	require.Empty(t, got.Items)
}

func TestService_Add_NewItem_Upserts(t *testing.T) {
	uid := uuid.New()
	pid := uuid.New()
	var observedQty int32
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		GetProduct: func(_ context.Context, _ uuid.UUID) (cart.FakeProduct, error) {
			return cart.FakeProduct{ID: pid, Name: "X-Wing", PriceCents: 12500000, StockQuantity: 10, IsActive: true}, nil
		},
		GetItemQuantity: func(_ context.Context, _, _ uuid.UUID) (int32, error) {
			return 0, nil
		},
		UpsertItem: func(_ context.Context, _, _ uuid.UUID, q int32) error {
			observedQty = q
			return nil
		},
	})
	item, err := svc.Add(context.Background(), uid, pid, 2)
	require.NoError(t, err)
	require.Equal(t, int32(2), item.Quantity)
	require.Equal(t, int32(2), observedQty)
}

func TestService_Add_ExistingItem_SumsQuantity(t *testing.T) {
	uid := uuid.New()
	pid := uuid.New()
	var observedQty int32
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		GetProduct: func(_ context.Context, _ uuid.UUID) (cart.FakeProduct, error) {
			return cart.FakeProduct{ID: pid, StockQuantity: 10, IsActive: true}, nil
		},
		GetItemQuantity: func(_ context.Context, _, _ uuid.UUID) (int32, error) {
			return 3, nil
		},
		UpsertItem: func(_ context.Context, _, _ uuid.UUID, q int32) error {
			observedQty = q
			return nil
		},
	})
	item, err := svc.Add(context.Background(), uid, pid, 2)
	require.NoError(t, err)
	require.Equal(t, int32(5), item.Quantity)
	require.Equal(t, int32(5), observedQty)
}

func TestService_Add_OverStock_ClampsToStock(t *testing.T) {
	uid := uuid.New()
	pid := uuid.New()
	var observedQty int32
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		GetProduct: func(_ context.Context, _ uuid.UUID) (cart.FakeProduct, error) {
			return cart.FakeProduct{ID: pid, StockQuantity: 4, IsActive: true}, nil
		},
		GetItemQuantity: func(_ context.Context, _, _ uuid.UUID) (int32, error) {
			return 3, nil
		},
		UpsertItem: func(_ context.Context, _, _ uuid.UUID, q int32) error {
			observedQty = q
			return nil
		},
	})
	item, err := svc.Add(context.Background(), uid, pid, 5)
	require.NoError(t, err)
	require.Equal(t, int32(4), item.Quantity, "sum 3+5 clamps down to stock 4")
	require.Equal(t, int32(4), observedQty)
}

func TestService_Add_InactiveProduct_Returns_ErrProductNotFound(t *testing.T) {
	uid := uuid.New()
	pid := uuid.New()
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		GetProduct: func(_ context.Context, _ uuid.UUID) (cart.FakeProduct, error) {
			return cart.FakeProduct{}, cart.ErrProductNotFound
		},
	})
	_, err := svc.Add(context.Background(), uid, pid, 1)
	require.ErrorIs(t, err, cart.ErrProductNotFound)
}

func TestService_Add_NonPositiveQuantity_Returns_ErrInvalidQuantity(t *testing.T) {
	uid := uuid.New()
	pid := uuid.New()
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{})
	_, err := svc.Add(context.Background(), uid, pid, 0)
	require.ErrorIs(t, err, cart.ErrInvalidQuantity)
}

func TestService_Set_ValidQuantity_Upserts(t *testing.T) {
	uid := uuid.New()
	pid := uuid.New()
	var observedQty int32
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		GetProduct: func(_ context.Context, _ uuid.UUID) (cart.FakeProduct, error) {
			return cart.FakeProduct{ID: pid, StockQuantity: 10, IsActive: true}, nil
		},
		UpsertItem: func(_ context.Context, _, _ uuid.UUID, q int32) error {
			observedQty = q
			return nil
		},
	})
	item, err := svc.Set(context.Background(), uid, pid, 3)
	require.NoError(t, err)
	require.Equal(t, int32(3), item.Quantity)
	require.Equal(t, int32(3), observedQty)
}

func TestService_Set_OverStock_Returns_ErrOverStock(t *testing.T) {
	uid := uuid.New()
	pid := uuid.New()
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		GetProduct: func(_ context.Context, _ uuid.UUID) (cart.FakeProduct, error) {
			return cart.FakeProduct{ID: pid, StockQuantity: 2, IsActive: true}, nil
		},
	})
	_, err := svc.Set(context.Background(), uid, pid, 5)
	require.ErrorIs(t, err, cart.ErrOverStock)
}

func TestService_Set_ZeroQuantity_Returns_ErrInvalidQuantity(t *testing.T) {
	uid := uuid.New()
	pid := uuid.New()
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{})
	_, err := svc.Set(context.Background(), uid, pid, 0)
	require.ErrorIs(t, err, cart.ErrInvalidQuantity)
}

func TestService_Remove_Deletes(t *testing.T) {
	uid := uuid.New()
	pid := uuid.New()
	called := false
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		DeleteItem: func(_ context.Context, _, _ uuid.UUID) error {
			called = true
			return nil
		},
	})
	err := svc.Remove(context.Background(), uid, pid)
	require.NoError(t, err)
	require.True(t, called)
}

func TestService_Merge_EmptyInput_ReturnsCurrentCart(t *testing.T) {
	uid := uuid.New()
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		GetItems: func(_ context.Context, _ uuid.UUID) ([]cart.Item, error) {
			return []cart.Item{{ProductID: uuid.New(), Quantity: 1}}, nil
		},
	})
	got, err := svc.Merge(context.Background(), uid, nil)
	require.NoError(t, err)
	require.Len(t, got.Items, 1)
}

func TestService_Merge_SumsQuantities_AndSkipsInactive(t *testing.T) {
	uid := uuid.New()
	active := uuid.New()
	inactive := uuid.New()
	upserts := map[uuid.UUID]int32{}
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		GetProduct: func(_ context.Context, id uuid.UUID) (cart.FakeProduct, error) {
			if id == active {
				return cart.FakeProduct{ID: active, StockQuantity: 10, IsActive: true}, nil
			}
			return cart.FakeProduct{}, cart.ErrProductNotFound
		},
		GetItemQuantity: func(_ context.Context, _, _ uuid.UUID) (int32, error) {
			return 0, nil
		},
		UpsertItem: func(_ context.Context, _, pid uuid.UUID, q int32) error {
			upserts[pid] = q
			return nil
		},
		GetItems: func(_ context.Context, _ uuid.UUID) ([]cart.Item, error) {
			return []cart.Item{{ProductID: active, Quantity: upserts[active]}}, nil
		},
	})
	got, err := svc.Merge(context.Background(), uid, []cart.MergeItem{
		{ProductID: active, Quantity: 2},
		{ProductID: inactive, Quantity: 5},
	})
	require.NoError(t, err)
	require.Len(t, got.Items, 1)
	require.Equal(t, int32(2), upserts[active])
	_, skipped := upserts[inactive]
	require.False(t, skipped, "inactive product must be silently skipped")
}

func TestService_Merge_SumWithExisting_ClampsToStock(t *testing.T) {
	uid := uuid.New()
	pid := uuid.New()
	var observedQty int32
	svc := cart.NewServiceFake(t, cart.FakeRepoAdapter{
		GetProduct: func(_ context.Context, _ uuid.UUID) (cart.FakeProduct, error) {
			return cart.FakeProduct{ID: pid, StockQuantity: 5, IsActive: true}, nil
		},
		GetItemQuantity: func(_ context.Context, _, _ uuid.UUID) (int32, error) {
			return 4, nil
		},
		UpsertItem: func(_ context.Context, _, _ uuid.UUID, q int32) error {
			observedQty = q
			return nil
		},
		GetItems: func(_ context.Context, _ uuid.UUID) ([]cart.Item, error) {
			return []cart.Item{{ProductID: pid, Quantity: observedQty, StockQuantity: 5}}, nil
		},
	})
	got, err := svc.Merge(context.Background(), uid, []cart.MergeItem{{ProductID: pid, Quantity: 3}})
	require.NoError(t, err)
	require.Len(t, got.Items, 1)
	require.Equal(t, int32(5), observedQty, "existing 4 + guest 3 = 7 clamps down to stock 5")
}
