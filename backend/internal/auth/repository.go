package auth

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// userRecord is the repository-layer representation that includes the
// password hash. It does not leave the auth package.
type userRecord struct {
	ID           uuid.UUID
	Email        string
	PasswordHash string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// Repository is the storage-facing interface the auth Service depends on.
// Implementations must be safe for concurrent use.
type Repository interface {
	CreateUser(ctx context.Context, email, passwordHash string) (userRecord, error)
	GetUserByEmail(ctx context.Context, email string) (userRecord, error)
	GetUserByID(ctx context.Context, id uuid.UUID) (userRecord, error)
}
