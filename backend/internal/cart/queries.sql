-- name: GetCartItems :many
SELECT
    ci.product_id,
    p.name,
    p.price_cents,
    p.image_url,
    ci.quantity,
    p.stock_quantity
FROM cart_items ci
JOIN products p ON p.id = ci.product_id
WHERE ci.user_id = $1 AND p.is_active = true
ORDER BY ci.created_at ASC;

-- name: GetProductForCart :one
SELECT id, name, price_cents, image_url, stock_quantity, is_active
FROM products
WHERE id = $1;

-- name: UpsertCartItem :one
INSERT INTO cart_items (user_id, product_id, quantity)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, product_id) DO UPDATE
    SET quantity   = EXCLUDED.quantity,
        updated_at = now()
RETURNING user_id, product_id, quantity;

-- name: GetCartItemQuantity :one
SELECT quantity
FROM cart_items
WHERE user_id = $1 AND product_id = $2;

-- name: DeleteCartItem :exec
DELETE FROM cart_items
WHERE user_id = $1 AND product_id = $2;

-- name: ClearCart :exec
DELETE FROM cart_items
WHERE user_id = $1;
