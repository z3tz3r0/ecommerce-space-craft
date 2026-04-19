package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	authdb "github.com/z3tz3r0/ecommerce-space-craft/backend/internal/auth/db"
)

// Postgres is the pgx/sqlc-backed implementation of Repository.
type Postgres struct {
	q *authdb.Queries
}

// NewPostgres wraps a pgxpool.Pool with the sqlc-generated Queries.
func NewPostgres(pool *pgxpool.Pool) *Postgres {
	return &Postgres{q: authdb.New(pool)}
}

// CreateUser inserts a new user and returns the stored record. A unique
// constraint violation on email maps to ErrEmailTaken.
func (p *Postgres) CreateUser(ctx context.Context, email, passwordHash string) (userRecord, error) {
	row, err := p.q.CreateUser(ctx, authdb.CreateUserParams{
		Email:        strings.ToLower(strings.TrimSpace(email)),
		PasswordHash: passwordHash,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return userRecord{}, ErrEmailTaken
		}
		return userRecord{}, fmt.Errorf("postgres: create user: %w", err)
	}
	return userRecord{
		ID:           row.ID,
		Email:        row.Email,
		PasswordHash: row.PasswordHash,
		CreatedAt:    row.CreatedAt,
		UpdatedAt:    row.UpdatedAt,
	}, nil
}

// GetUserByEmail returns the stored user record for the given email
// (case-insensitive via citext), or ErrUserNotFound if none exists.
func (p *Postgres) GetUserByEmail(ctx context.Context, email string) (userRecord, error) {
	row, err := p.q.GetUserByEmail(ctx, strings.ToLower(strings.TrimSpace(email)))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return userRecord{}, ErrUserNotFound
		}
		return userRecord{}, fmt.Errorf("postgres: get user by email: %w", err)
	}
	return userRecord{
		ID:           row.ID,
		Email:        row.Email,
		PasswordHash: row.PasswordHash,
		CreatedAt:    row.CreatedAt,
		UpdatedAt:    row.UpdatedAt,
	}, nil
}

// GetUserByID returns the stored user record for the given UUID, or
// ErrUserNotFound if none exists.
func (p *Postgres) GetUserByID(ctx context.Context, id uuid.UUID) (userRecord, error) {
	row, err := p.q.GetUserByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return userRecord{}, ErrUserNotFound
		}
		return userRecord{}, fmt.Errorf("postgres: get user by id: %w", err)
	}
	return userRecord{
		ID:           row.ID,
		Email:        row.Email,
		PasswordHash: row.PasswordHash,
		CreatedAt:    row.CreatedAt,
		UpdatedAt:    row.UpdatedAt,
	}, nil
}
