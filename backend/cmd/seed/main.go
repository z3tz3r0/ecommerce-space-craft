// Command seed populates or truncates the products table from
// backend/data/products.json.
//
// Usage:
//
//	go run ./cmd/seed          # INSERT all products from products.json
//	go run ./cmd/seed -d       # TRUNCATE products (destroy)
package main

import (
	"context"
	"encoding/json"
	"flag"
	"log"
	"os"
	"time"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/catalog"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/config"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/db"
)

type seedProduct struct {
	Name          string  `json:"name"`
	Description   string  `json:"description"`
	PriceCents    int64   `json:"priceCents"`
	ImageURL      *string `json:"imageUrl,omitempty"`
	Manufacturer  *string `json:"manufacturer,omitempty"`
	CrewAmount    *int32  `json:"crewAmount,omitempty"`
	MaxSpeed      *string `json:"maxSpeed,omitempty"`
	Category      string  `json:"category"`
	StockQuantity int32   `json:"stockQuantity"`
	IsActive      bool    `json:"isActive"`
}

func main() {
	destroy := flag.Bool("d", false, "truncate products instead of inserting")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := db.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer pool.Close()

	store := catalog.NewPostgres(pool)

	if *destroy {
		if err := store.DeleteAll(ctx); err != nil {
			log.Fatalf("destroy: %v", err)
		}
		log.Println("truncated products")
		return
	}

	raw, err := os.ReadFile("data/products.json")
	if err != nil {
		log.Fatalf("read seed: %v", err)
	}

	var items []seedProduct
	if err := json.Unmarshal(raw, &items); err != nil {
		log.Fatalf("unmarshal seed: %v", err)
	}

	for _, it := range items {
		if _, err := store.Create(ctx, catalog.CreateInput{
			Name:          it.Name,
			Description:   it.Description,
			PriceCents:    it.PriceCents,
			ImageURL:      it.ImageURL,
			Manufacturer:  it.Manufacturer,
			CrewAmount:    it.CrewAmount,
			MaxSpeed:      it.MaxSpeed,
			Category:      catalog.Category(it.Category),
			StockQuantity: it.StockQuantity,
			IsActive:      it.IsActive,
		}); err != nil {
			log.Fatalf("insert %s: %v", it.Name, err)
		}
	}
	log.Printf("seeded %d products", len(items))
}
