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
		Summary:     "List active products, optionally filtered to featured only",
		Tags:        []string{"Catalog"},
	}, func(ctx context.Context, in *ListProductsInput) (*ListProductsOutput, error) {
		if in.Featured {
			products, err := svc.ListFeatured(ctx, in.Limit)
			if err != nil {
				return nil, mapError(logger, err)
			}
			return &ListProductsOutput{Body: products}, nil
		}
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

// ListProductsInput is the Huma input for the catalog list endpoint.
//
// When Featured is false (the default), Limit is ignored and ALL active
// products are returned. When Featured is true, Limit caps the result count;
// when omitted, the service applies a server-side default.
type ListProductsInput struct {
	Featured bool  `query:"featured" doc:"Return only featured products"`
	Limit    int32 `query:"limit" minimum:"1" maximum:"24" doc:"Cap on featured results; omit to use the server default. Ignored when featured is false."`
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
