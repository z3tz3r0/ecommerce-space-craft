-- +goose Up
ALTER TABLE products
  ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_products_featured
  ON products (is_featured)
  WHERE is_featured = true;

-- +goose Down
DROP INDEX IF EXISTS idx_products_featured;
ALTER TABLE products DROP COLUMN IF EXISTS is_featured;
