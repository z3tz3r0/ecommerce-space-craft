package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

// Service holds business logic for the auth bounded context.
type Service struct {
	repo Repository
}

// NewService constructs a Service wrapping the given Repository.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Signup creates a new user with the given email and password. The password
// is hashed with argon2id. Returns ErrWeakPassword if the password is too
// short, ErrEmailTaken if the email is already registered.
func (s *Service) Signup(ctx context.Context, email, password string) (User, error) {
	if len(password) < MinPasswordLength {
		return User{}, ErrWeakPassword
	}
	normalisedEmail := strings.ToLower(strings.TrimSpace(email))
	hash, err := hashPassword(password)
	if err != nil {
		return User{}, fmt.Errorf("auth: hash password: %w", err)
	}
	rec, err := s.repo.CreateUser(ctx, normalisedEmail, hash)
	if err != nil {
		return User{}, fmt.Errorf("auth: signup create user: %w", err)
	}
	return User{
		ID:        rec.ID,
		Email:     rec.Email,
		CreatedAt: rec.CreatedAt,
		UpdatedAt: rec.UpdatedAt,
	}, nil
}

// Login verifies the email/password combination. It returns
// ErrInvalidCredentials for both unknown emails and wrong passwords to
// prevent user enumeration. Repository failures unrelated to lookup
// (e.g. DB outage) propagate so the operator sees a real 500 instead of
// a misleading "invalid credentials".
func (s *Service) Login(ctx context.Context, email, password string) (User, error) {
	rec, err := s.repo.GetUserByEmail(ctx, strings.ToLower(strings.TrimSpace(email)))
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			return User{}, ErrInvalidCredentials
		}
		return User{}, fmt.Errorf("auth: login lookup: %w", err)
	}
	ok, err := verifyPassword(password, rec.PasswordHash)
	if err != nil {
		return User{}, fmt.Errorf("auth: verify password: %w", err)
	}
	if !ok {
		return User{}, ErrInvalidCredentials
	}
	return User{
		ID:        rec.ID,
		Email:     rec.Email,
		CreatedAt: rec.CreatedAt,
		UpdatedAt: rec.UpdatedAt,
	}, nil
}

// GetByID returns the user with the given UUID.
func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (User, error) {
	rec, err := s.repo.GetUserByID(ctx, id)
	if err != nil {
		return User{}, fmt.Errorf("auth: get user by id: %w", err)
	}
	return User{
		ID:        rec.ID,
		Email:     rec.Email,
		CreatedAt: rec.CreatedAt,
		UpdatedAt: rec.UpdatedAt,
	}, nil
}
