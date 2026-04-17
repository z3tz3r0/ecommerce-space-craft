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
