-- +goose Up
CREATE TABLE sessions (
    token   text        PRIMARY KEY,
    data    bytea       NOT NULL,
    expiry  timestamptz NOT NULL
);
CREATE INDEX sessions_expiry_idx ON sessions (expiry);

CREATE TABLE cart_items (
    user_id       uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id    uuid        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity      integer     NOT NULL CHECK (quantity > 0),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, product_id)
);

-- +goose Down
DROP TABLE cart_items;
DROP TABLE sessions;
