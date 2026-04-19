package auth

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/server"
	"github.com/z3tz3r0/ecommerce-space-craft/backend/internal/platform/session"
)

// Register registers all auth endpoints on the given Huma API.
//
// The signup + login handlers regenerate the session token on success
// (session fixation mitigation) and store the current user's UUID under
// the userIDKey. The logout handler destroys the server-side session.
// The me endpoint is protected by RequireAuth middleware composed at
// registration time.
func Register(api huma.API, svc *Service, sess session.Manager, logger *slog.Logger) {
	huma.Register(api, huma.Operation{
		OperationID:   "signup",
		Method:        http.MethodPost,
		Path:          "/api/auth/signup",
		Summary:       "Create a new account and start a session",
		Tags:          []string{"Auth"},
		DefaultStatus: http.StatusCreated,
	}, func(ctx context.Context, in *SignupInput) (*UserOutput, error) {
		// Renew the session token BEFORE creating the user. If RenewToken
		// fails after a successful Signup, the user is created in the DB
		// with no session — client retry hits ErrEmailTaken and the account
		// is permanently stuck. Pre-rotating is safe because the userID
		// isn't placed in the session until after Signup succeeds.
		if err := sess.RenewToken(ctx); err != nil {
			logger.Error("auth: renew token on signup", "err", err.Error())
			return nil, huma.Error500InternalServerError("internal error")
		}
		user, err := svc.Signup(ctx, in.Body.Email, in.Body.Password)
		if err != nil {
			return nil, mapError(logger, err)
		}
		sess.Put(ctx, userIDKey, user.ID.String())
		return &UserOutput{Body: user}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "login",
		Method:      http.MethodPost,
		Path:        "/api/auth/login",
		Summary:     "Log in with email and password",
		Tags:        []string{"Auth"},
	}, func(ctx context.Context, in *LoginInput) (*UserOutput, error) {
		user, err := svc.Login(ctx, in.Body.Email, in.Body.Password)
		if err != nil {
			return nil, mapError(logger, err)
		}
		if err := sess.RenewToken(ctx); err != nil {
			logger.Error("auth: renew token on login", "err", err.Error())
			return nil, huma.Error500InternalServerError("internal error")
		}
		sess.Put(ctx, userIDKey, user.ID.String())
		return &UserOutput{Body: user}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID:   "logout",
		Method:        http.MethodPost,
		Path:          "/api/auth/logout",
		Summary:       "End the current session",
		Tags:          []string{"Auth"},
		DefaultStatus: http.StatusNoContent,
	}, func(ctx context.Context, _ *struct{}) (*struct{}, error) {
		if err := sess.Destroy(ctx); err != nil {
			logger.Error("auth: destroy session on logout", "err", err.Error())
			return nil, huma.Error500InternalServerError("internal error")
		}
		return nil, nil
	})

	meOp := huma.Operation{
		OperationID: "getMe",
		Method:      http.MethodGet,
		Path:        "/api/auth/me",
		Summary:     "Fetch the currently authenticated user",
		Tags:        []string{"Auth"},
		Middlewares: huma.Middlewares{RequireAuth(api, sess, svc, logger)},
		Security:    []map[string][]string{{server.SessionSecurityScheme: {}}},
	}
	huma.Register(api, meOp, func(ctx context.Context, _ *struct{}) (*UserOutput, error) {
		return &UserOutput{Body: MustCurrentUser(ctx)}, nil
	})
}

// SignupInput is the request body for the signup endpoint.
type SignupInput struct {
	Body struct {
		Email    string `json:"email" format:"email" doc:"User email (case-insensitive)"`
		Password string `json:"password" minLength:"8" doc:"At least 8 characters"`
	}
}

// LoginInput is the request body for the login endpoint.
type LoginInput struct {
	Body struct {
		Email    string `json:"email" format:"email"`
		Password string `json:"password" minLength:"1"`
	}
}

// UserOutput wraps a single User for response bodies.
type UserOutput struct {
	Body User
}
