package auth

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

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
// prevent user enumeration.
func (s *Service) Login(ctx context.Context, email, password string) (User, error) {
	rec, err := s.repo.GetUserByEmail(ctx, strings.ToLower(strings.TrimSpace(email)))
	if err != nil {
		// Collapse ErrUserNotFound and any other lookup failure into
		// ErrInvalidCredentials — the client must not be able to tell
		// whether the email was known.
		return User{}, ErrInvalidCredentials
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

// --- test-only helpers -------------------------------------------------
// Exported so *_test.go files can construct fakes without touching the
// package-private Repository / userRecord types. The *testing.T parameter
// on NewServiceFake prevents misuse from non-test code.

// FakeRecord mirrors the private userRecord shape for test construction.
type FakeRecord struct {
	ID           uuid.UUID
	Email        string
	PasswordHash string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// FakeRepoAdapter lets tests supply behavior for each Repository method.
// Any unset callback falls back to a sensible default (typically
// ErrUserNotFound so tests can omit methods they don't exercise).
type FakeRepoAdapter struct {
	Create     func(ctx context.Context, email, hash string) (FakeRecord, error)
	GetByEmail func(ctx context.Context, email string) (FakeRecord, error)
	GetByID    func(ctx context.Context, id uuid.UUID) (FakeRecord, error)
}

// NewServiceFake builds a Service backed by an in-memory fake repository.
// Pass nil for *testing.T from code that only needs spec registration
// (e.g. cmd/openapi). Production code must never call this.
func NewServiceFake(_ *testing.T, a FakeRepoAdapter) *Service {
	return NewService(fakeRepoImpl{a: a})
}

type fakeRepoImpl struct{ a FakeRepoAdapter }

func (f fakeRepoImpl) CreateUser(ctx context.Context, email, hash string) (userRecord, error) {
	if f.a.Create == nil {
		return userRecord{}, fmt.Errorf("fake: Create not configured")
	}
	r, err := f.a.Create(ctx, email, hash)
	return toUserRecordFromFake(r), err
}

func (f fakeRepoImpl) GetUserByEmail(ctx context.Context, email string) (userRecord, error) {
	if f.a.GetByEmail == nil {
		return userRecord{}, ErrUserNotFound
	}
	r, err := f.a.GetByEmail(ctx, email)
	return toUserRecordFromFake(r), err
}

func (f fakeRepoImpl) GetUserByID(ctx context.Context, id uuid.UUID) (userRecord, error) {
	if f.a.GetByID == nil {
		return userRecord{}, ErrUserNotFound
	}
	r, err := f.a.GetByID(ctx, id)
	return toUserRecordFromFake(r), err
}

func toUserRecordFromFake(r FakeRecord) userRecord {
	return userRecord(r)
}
