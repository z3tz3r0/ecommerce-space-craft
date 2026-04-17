-- name: GetProductByID :one
SELECT
    id, name, description, price_cents, image_url,
    manufacturer, crew_amount, max_speed, category,
    stock_quantity, is_active, created_at, updated_at
FROM products
WHERE id = $1 AND is_active = true;

-- name: ListActiveProducts :many
SELECT
    id, name, description, price_cents, image_url,
    manufacturer, crew_amount, max_speed, category,
    stock_quantity, is_active, created_at, updated_at
FROM products
WHERE is_active = true
ORDER BY created_at DESC;

-- name: InsertProduct :one
INSERT INTO products (
    name, description, price_cents, image_url,
    manufacturer, crew_amount, max_speed, category,
    stock_quantity, is_active
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
)
RETURNING id, name, description, price_cents, image_url,
    manufacturer, crew_amount, max_speed, category,
    stock_quantity, is_active, created_at, updated_at;

-- name: TruncateProducts :exec
TRUNCATE products;
