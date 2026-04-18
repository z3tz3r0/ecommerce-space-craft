package catalog_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/catalog"
)

// mockRepo is a hand-rolled test double. No mocking library needed for two methods.
type mockRepo struct {
	getByIDFn      func(ctx context.Context, id uuid.UUID) (catalog.Product, error)
	listActiveFn   func(ctx context.Context) ([]catalog.Product, error)
	listFeaturedFn func(ctx context.Context, limit int32) ([]catalog.Product, error)
}

func (m mockRepo) GetByID(ctx context.Context, id uuid.UUID) (catalog.Product, error) {
	return m.getByIDFn(ctx, id)
}

func (m mockRepo) ListActive(ctx context.Context) ([]catalog.Product, error) {
	return m.listActiveFn(ctx)
}

func (m mockRepo) ListFeatured(ctx context.Context, limit int32) ([]catalog.Product, error) {
	return m.listFeaturedFn(ctx, limit)
}

func TestService_GetByID_ValidID_ReturnsProduct(t *testing.T) {
	want := catalog.Product{
		ID:       uuid.New(),
		Name:     "Test Craft",
		Category: catalog.CategoryFighter,
	}
	repo := mockRepo{
		getByIDFn: func(_ context.Context, _ uuid.UUID) (catalog.Product, error) {
			return want, nil
		},
	}
	svc := catalog.NewService(repo)

	got, err := svc.GetByID(context.Background(), want.ID.String())
	require.NoError(t, err)
	require.Equal(t, want.ID, got.ID)
}

func TestService_GetByID_InvalidUUID_ReturnsErrInvalidID(t *testing.T) {
	svc := catalog.NewService(mockRepo{})

	_, err := svc.GetByID(context.Background(), "not-a-uuid")
	require.ErrorIs(t, err, catalog.ErrInvalidID)
}

func TestService_GetByID_NotFound_PropagatesErr(t *testing.T) {
	repo := mockRepo{
		getByIDFn: func(_ context.Context, _ uuid.UUID) (catalog.Product, error) {
			return catalog.Product{}, catalog.ErrProductNotFound
		},
	}
	svc := catalog.NewService(repo)

	_, err := svc.GetByID(context.Background(), uuid.New().String())
	require.ErrorIs(t, err, catalog.ErrProductNotFound)
}

func TestService_GetByID_RepoOtherError_Wrapped(t *testing.T) {
	boom := errors.New("db exploded")
	repo := mockRepo{
		getByIDFn: func(_ context.Context, _ uuid.UUID) (catalog.Product, error) {
			return catalog.Product{}, boom
		},
	}
	svc := catalog.NewService(repo)

	_, err := svc.GetByID(context.Background(), uuid.New().String())
	require.Error(t, err)
	require.ErrorIs(t, err, boom)
}

func TestService_ListActive_ReturnsRepoResult(t *testing.T) {
	want := []catalog.Product{
		{ID: uuid.New(), Name: "A", Category: catalog.CategoryFighter},
		{ID: uuid.New(), Name: "B", Category: catalog.CategoryCruiser},
	}
	repo := mockRepo{
		listActiveFn: func(_ context.Context) ([]catalog.Product, error) {
			return want, nil
		},
	}
	svc := catalog.NewService(repo)

	got, err := svc.ListActive(context.Background())
	require.NoError(t, err)
	require.Len(t, got, 2)
	require.Equal(t, want[0].Name, got[0].Name)
}

func TestService_ListFeatured_DefaultLimit_When_LimitZero(t *testing.T) {
	var captured int32
	repo := mockRepo{
		listFeaturedFn: func(_ context.Context, limit int32) ([]catalog.Product, error) {
			captured = limit
			return nil, nil
		},
	}
	svc := catalog.NewService(repo)

	_, err := svc.ListFeatured(context.Background(), 0)
	require.NoError(t, err)
	require.Equal(t, int32(12), captured)
}

func TestService_ListFeatured_DefaultLimit_When_LimitNegative(t *testing.T) {
	var captured int32
	repo := mockRepo{
		listFeaturedFn: func(_ context.Context, limit int32) ([]catalog.Product, error) {
			captured = limit
			return nil, nil
		},
	}
	svc := catalog.NewService(repo)

	_, err := svc.ListFeatured(context.Background(), -5)
	require.NoError(t, err)
	require.Equal(t, int32(12), captured)
}

func TestService_ListFeatured_HonoursCustomLimit(t *testing.T) {
	var captured int32
	repo := mockRepo{
		listFeaturedFn: func(_ context.Context, limit int32) ([]catalog.Product, error) {
			captured = limit
			return nil, nil
		},
	}
	svc := catalog.NewService(repo)

	_, err := svc.ListFeatured(context.Background(), 7)
	require.NoError(t, err)
	require.Equal(t, int32(7), captured)
}

func TestService_ListFeatured_ClampsLimitToMax(t *testing.T) {
	var captured int32
	repo := mockRepo{
		listFeaturedFn: func(_ context.Context, limit int32) ([]catalog.Product, error) {
			captured = limit
			return nil, nil
		},
	}
	svc := catalog.NewService(repo)

	_, err := svc.ListFeatured(context.Background(), 100)
	require.NoError(t, err)
	require.Equal(t, int32(24), captured)
}

func TestService_ListFeatured_PropagatesRepoError(t *testing.T) {
	boom := errors.New("db exploded")
	repo := mockRepo{
		listFeaturedFn: func(_ context.Context, _ int32) ([]catalog.Product, error) {
			return nil, boom
		},
	}
	svc := catalog.NewService(repo)

	_, err := svc.ListFeatured(context.Background(), 5)
	require.Error(t, err)
	require.ErrorIs(t, err, boom)
}
