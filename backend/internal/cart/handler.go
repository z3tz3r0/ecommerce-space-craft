package cart

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/auth"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/server"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/session"
)

// cartSecurity is the OpenAPI Security entry shared by every cart operation
// since they're all gated by RequireAuth and use the same session cookie.
var cartSecurity = []map[string][]string{{server.SessionSecurityScheme: {}}}

// Register registers all cart endpoints. All endpoints are gated by
// auth.RequireAuth.
func Register(api huma.API, svc *Service, authSvc *auth.Service, sess session.Manager, logger *slog.Logger) {
	requireAuth := auth.RequireAuth(api, sess, authSvc, logger)

	huma.Register(api, huma.Operation{
		OperationID: "getCart",
		Method:      http.MethodGet,
		Path:        "/api/cart",
		Summary:     "Fetch the authenticated user's cart",
		Tags:        []string{"Cart"},
		Middlewares: huma.Middlewares{requireAuth},
		Security:    cartSecurity,
	}, func(ctx context.Context, _ *struct{}) (*CartOutput, error) {
		u := auth.MustCurrentUser(ctx)
		c, err := svc.Get(ctx, u.ID)
		if err != nil {
			return nil, mapError(logger, err)
		}
		return &CartOutput{Body: c}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "addCartItem",
		Method:      http.MethodPost,
		Path:        "/api/cart/items",
		Summary:     "Add or increment a cart line (clamped to stock)",
		Tags:        []string{"Cart"},
		Middlewares: huma.Middlewares{requireAuth},
		Security:    cartSecurity,
	}, func(ctx context.Context, in *AddCartItemInput) (*CartItemOutput, error) {
		u := auth.MustCurrentUser(ctx)
		pid, err := uuid.Parse(in.Body.ProductID)
		if err != nil {
			return nil, huma.Error400BadRequest("invalid productId")
		}
		item, err := svc.Add(ctx, u.ID, pid, in.Body.Quantity)
		if err != nil {
			return nil, mapError(logger, err)
		}
		return &CartItemOutput{Body: item}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "setCartItem",
		Method:      http.MethodPatch,
		Path:        "/api/cart/items/{productId}",
		Summary:     "Set the exact quantity of a cart line",
		Tags:        []string{"Cart"},
		Middlewares: huma.Middlewares{requireAuth},
		Security:    cartSecurity,
	}, func(ctx context.Context, in *SetCartItemInput) (*CartItemOutput, error) {
		u := auth.MustCurrentUser(ctx)
		pid, err := uuid.Parse(in.ProductID)
		if err != nil {
			return nil, huma.Error400BadRequest("invalid productId")
		}
		item, err := svc.Set(ctx, u.ID, pid, in.Body.Quantity)
		if err != nil {
			return nil, mapError(logger, err)
		}
		return &CartItemOutput{Body: item}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "removeCartItem",
		Method:        http.MethodDelete,
		Path:          "/api/cart/items/{productId}",
		Summary:       "Remove a cart line",
		Tags:          []string{"Cart"},
		DefaultStatus: http.StatusNoContent,
		Middlewares:   huma.Middlewares{requireAuth},
		Security:      cartSecurity,
	}, func(ctx context.Context, in *RemoveCartItemInput) (*struct{}, error) {
		u := auth.MustCurrentUser(ctx)
		pid, err := uuid.Parse(in.ProductID)
		if err != nil {
			return nil, huma.Error400BadRequest("invalid productId")
		}
		if err := svc.Remove(ctx, u.ID, pid); err != nil {
			return nil, mapError(logger, err)
		}
		return nil, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "mergeCart",
		Method:      http.MethodPost,
		Path:        "/api/cart/merge",
		Summary:     "Merge a guest cart into the authenticated user's cart",
		Tags:        []string{"Cart"},
		Middlewares: huma.Middlewares{requireAuth},
		Security:    cartSecurity,
	}, func(ctx context.Context, in *MergeCartInput) (*CartOutput, error) {
		u := auth.MustCurrentUser(ctx)
		items := make([]MergeItem, 0, len(in.Body.Items))
		for _, it := range in.Body.Items {
			pid, err := uuid.Parse(it.ProductID)
			if err != nil {
				continue
			}
			items = append(items, MergeItem{ProductID: pid, Quantity: it.Quantity})
		}
		c, err := svc.Merge(ctx, u.ID, items)
		if err != nil {
			return nil, mapError(logger, err)
		}
		return &CartOutput{Body: c}, nil
	})
}

// AddCartItemInput is the request body for POST /api/cart/items.
type AddCartItemInput struct {
	Body struct {
		ProductID string `json:"productId" doc:"Product UUID"`
		Quantity  int32  `json:"quantity" minimum:"1" doc:"Quantity to add (clamped to stock)"`
	}
}

// SetCartItemInput is the path+body for PATCH /api/cart/items/{productId}.
type SetCartItemInput struct {
	ProductID string `path:"productId" doc:"Product UUID"`
	Body      struct {
		Quantity int32 `json:"quantity" minimum:"1" doc:"Exact quantity to set"`
	}
}

// RemoveCartItemInput is the path for DELETE /api/cart/items/{productId}.
type RemoveCartItemInput struct {
	ProductID string `path:"productId" doc:"Product UUID"`
}

// MergeCartInputItem is one guest-cart line in the merge request body.
// Lifted to a named type so Huma's schema registry doesn't collide with
// the cart.Item domain type.
type MergeCartInputItem struct {
	ProductID string `json:"productId"`
	Quantity  int32  `json:"quantity" minimum:"1"`
}

// MergeCartInput is the request body for POST /api/cart/merge.
type MergeCartInput struct {
	Body struct {
		Items []MergeCartInputItem `json:"items"`
	}
}

// CartOutput wraps a Cart for response bodies.
type CartOutput struct {
	Body Cart
}

// CartItemOutput wraps a single Item for response bodies.
type CartItemOutput struct {
	Body Item
}
