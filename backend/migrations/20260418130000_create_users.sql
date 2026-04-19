-- +goose Up
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    email           citext      UNIQUE NOT NULL,
    password_hash   text        NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE users;
-- Intentionally NOT dropping citext: this migration may not own the
-- extension (it can pre-exist or be referenced by tables added later).
-- Leaving it installed is safe; dropping it could break unrelated columns.
