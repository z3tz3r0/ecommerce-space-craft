-- +goose Up
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE products (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    name            varchar(100)  NOT NULL CHECK (length(name) >= 3),
    description     text          NOT NULL,
    price_cents     bigint        NOT NULL CHECK (price_cents >= 0),
    image_url       text,
    manufacturer    text,
    crew_amount     integer       CHECK (crew_amount IS NULL OR crew_amount >= 0),
    max_speed       text,
    category        text          NOT NULL CHECK (
                       category IN ('Fighter','Freighter','Shuttle','Speeder','Cruiser','Capital Ship')
                    ),
    stock_quantity  integer       NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    is_active       boolean       NOT NULL DEFAULT true,
    created_at      timestamptz   NOT NULL DEFAULT now(),
    updated_at      timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_category_active ON products (category) WHERE is_active = true;
CREATE INDEX idx_products_created_at      ON products (created_at DESC);

-- +goose Down
DROP TABLE products;
