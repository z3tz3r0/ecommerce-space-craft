// Package auth is the identity bounded context. It owns users, password
// hashing, and login/signup flows. Session cookies are owned by the platform
// session package; this context stores the authenticated userID value.
package auth

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

// User is the public-facing user representation. PasswordHash is
// intentionally absent — it never leaves the repository layer.
type User struct {
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// Sentinel errors exposed by the auth context.
var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrEmailTaken         = errors.New("email already registered")
	ErrWeakPassword       = errors.New("password must be at least 8 characters")
	ErrUserNotFound       = errors.New("user not found")
	ErrNotAuthenticated   = errors.New("not authenticated")
)

// MinPasswordLength is the minimum acceptable password length per the spec.
const MinPasswordLength = 8
