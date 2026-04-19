package auth_test

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/alexedwards/argon2id"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/auth"
)

func validHash(t *testing.T) string {
	t.Helper()
	h, err := argon2id.CreateHash("hunter2!!", &argon2id.Params{
		Memory: 32 * 1024, Iterations: 1, Parallelism: 1, SaltLength: 8, KeyLength: 16,
	})
	require.NoError(t, err)
	return h
}

func TestService_Signup_WeakPassword_Returns_ErrWeakPassword(t *testing.T) {
	svc := auth.NewServiceFake(t, auth.FakeRepoAdapter{})
	_, err := svc.Signup(context.Background(), "a@b.com", "short")
	require.ErrorIs(t, err, auth.ErrWeakPassword)
}

func TestService_Signup_EmailTaken_Returns_ErrEmailTaken(t *testing.T) {
	svc := auth.NewServiceFake(t, auth.FakeRepoAdapter{
		Create: func(_ context.Context, _, _ string) (auth.FakeRecord, error) {
			return auth.FakeRecord{}, auth.ErrEmailTaken
		},
	})
	_, err := svc.Signup(context.Background(), "a@b.com", "hunter2!!")
	require.ErrorIs(t, err, auth.ErrEmailTaken)
}

func TestService_Signup_Success_ReturnsUserAndHashesPassword(t *testing.T) {
	uid := uuid.New()
	now := time.Now()
	var observedHash string
	adapter := auth.FakeRepoAdapter{
		Create: func(_ context.Context, email, hash string) (auth.FakeRecord, error) {
			observedHash = hash
			return auth.FakeRecord{ID: uid, Email: email, PasswordHash: hash, CreatedAt: now, UpdatedAt: now}, nil
		},
	}
	svc := auth.NewServiceFake(t, adapter)

	user, err := svc.Signup(context.Background(), "A@B.com", "hunter2!!")
	require.NoError(t, err)
	require.Equal(t, uid, user.ID)
	require.Equal(t, "a@b.com", user.Email)
	require.NotEmpty(t, observedHash)
	require.True(t, strings.HasPrefix(observedHash, "$argon2id$"))
}

func TestService_Login_UnknownEmail_Returns_ErrInvalidCredentials(t *testing.T) {
	svc := auth.NewServiceFake(t, auth.FakeRepoAdapter{
		GetByEmail: func(_ context.Context, _ string) (auth.FakeRecord, error) {
			return auth.FakeRecord{}, auth.ErrUserNotFound
		},
	})
	_, err := svc.Login(context.Background(), "nobody@x.com", "hunter2!!")
	require.ErrorIs(t, err, auth.ErrInvalidCredentials)
}

func TestService_Login_WrongPassword_Returns_ErrInvalidCredentials(t *testing.T) {
	uid := uuid.New()
	now := time.Now()
	svc := auth.NewServiceFake(t, auth.FakeRepoAdapter{
		GetByEmail: func(_ context.Context, _ string) (auth.FakeRecord, error) {
			return auth.FakeRecord{ID: uid, Email: "a@b.com", PasswordHash: validHash(t), CreatedAt: now, UpdatedAt: now}, nil
		},
	})
	_, err := svc.Login(context.Background(), "a@b.com", "wrong-password")
	require.ErrorIs(t, err, auth.ErrInvalidCredentials)
}

func TestService_Login_CorrectPassword_ReturnsUser(t *testing.T) {
	uid := uuid.New()
	now := time.Now()
	hash := validHash(t)
	svc := auth.NewServiceFake(t, auth.FakeRepoAdapter{
		GetByEmail: func(_ context.Context, email string) (auth.FakeRecord, error) {
			return auth.FakeRecord{ID: uid, Email: email, PasswordHash: hash, CreatedAt: now, UpdatedAt: now}, nil
		},
	})
	user, err := svc.Login(context.Background(), "a@b.com", "hunter2!!")
	require.NoError(t, err)
	require.Equal(t, uid, user.ID)
}

func TestService_GetByID_UnknownUser_WrapsErr(t *testing.T) {
	svc := auth.NewServiceFake(t, auth.FakeRepoAdapter{
		GetByID: func(_ context.Context, _ uuid.UUID) (auth.FakeRecord, error) {
			return auth.FakeRecord{}, auth.ErrUserNotFound
		},
	})
	_, err := svc.GetByID(context.Background(), uuid.New())
	require.ErrorIs(t, err, auth.ErrUserNotFound)
}

func TestService_GetByID_RepoOtherError_PropagatesWrapped(t *testing.T) {
	boom := errors.New("db exploded")
	svc := auth.NewServiceFake(t, auth.FakeRepoAdapter{
		GetByID: func(_ context.Context, _ uuid.UUID) (auth.FakeRecord, error) {
			return auth.FakeRecord{}, boom
		},
	})
	_, err := svc.GetByID(context.Background(), uuid.New())
	require.Error(t, err)
	require.NotErrorIs(t, err, auth.ErrUserNotFound)
}
