package catalog

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// Register registers all catalog endpoints on the given Huma API.
func Register(api huma.API, svc *Service, logger *slog.Logger) {
	huma.Register(api, huma.Operation{
		OperationID: "listProducts",
		Method:      http.MethodGet,
		Path:        "/api/products",
		Summary:     "List all active products",
		Tags:        []string{"Catalog"},
	}, func(ctx context.Context, _ *struct{}) (*ListProductsOutput, error) {
		products, err := svc.ListActive(ctx)
		if err != nil {
			return nil, mapError(logger, err)
		}
		return &ListProductsOutput{Body: products}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getProduct",
		Method:      http.MethodGet,
		Path:        "/api/products/{id}",
		Summary:     "Fetch a single product by id",
		Tags:        []string{"Catalog"},
	}, func(ctx context.Context, in *GetProductInput) (*GetProductOutput, error) {
		p, err := svc.GetByID(ctx, in.ID)
		if err != nil {
			return nil, mapError(logger, err)
		}
		return &GetProductOutput{Body: p}, nil
	})
}

// GetProductInput is the Huma input for fetching a single product.
type GetProductInput struct {
	ID string `path:"id" doc:"Product UUID"`
}

// GetProductOutput wraps a single Product.
type GetProductOutput struct {
	Body Product
}

// ListProductsOutput wraps the product list.
type ListProductsOutput struct {
	Body []Product
}
