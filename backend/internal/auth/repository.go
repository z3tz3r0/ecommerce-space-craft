package auth

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// UserRecord is the repository-layer representation that carries the
// password hash. The auth.Service maps it to the public auth.User (which
// omits the hash) before crossing the package boundary.
//
// Exported so external packages — the spec-extraction binary cmd/openapi,
// in particular — can implement no-op Repository fakes without needing
// access to package-private types.
type UserRecord struct {
	ID           uuid.UUID
	Email        string
	PasswordHash string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// Repository is the storage-facing interface the auth Service depends on.
// Implementations must be safe for concurrent use.
type Repository interface {
	CreateUser(ctx context.Context, email, passwordHash string) (UserRecord, error)
	GetUserByEmail(ctx context.Context, email string) (UserRecord, error)
	GetUserByID(ctx context.Context, id uuid.UUID) (UserRecord, error)
}
