package auth

import "github.com/alexedwards/argon2id"

// hashParams are the argon2id parameters used for every password.
//
// 64 MB memory / 1 iteration / 2 parallelism balances OWASP recommendations
// against Render's free-tier CPU budget. Params are embedded into each
// produced hash string, so upgrading these values later still validates
// existing hashes against their stored params.
var hashParams = &argon2id.Params{
	Memory:      64 * 1024, // 64 MB
	Iterations:  1,
	Parallelism: 2,
	SaltLength:  16,
	KeyLength:   32,
}

// hashPassword produces an argon2id encoded hash string.
func hashPassword(plaintext string) (string, error) {
	return argon2id.CreateHash(plaintext, hashParams)
}

// verifyPassword reports whether the plaintext matches the stored hash. The
// comparison is constant-time.
func verifyPassword(plaintext, encodedHash string) (bool, error) {
	return argon2id.ComparePasswordAndHash(plaintext, encodedHash)
}

// dummyHash is a precomputed argon2id hash with the same params as the
// production hasher. Login compares against it on the user-not-found path
// so the response time matches the user-found path — defeats timing-based
// email enumeration. Computed once at process start; the contents don't
// matter, only that hashing it costs the same as hashing a real user's hash.
//
//nolint:gochecknoglobals // intentional package-level cache of an idempotent computation
var dummyHash = mustComputeDummyHash()

func mustComputeDummyHash() string {
	h, err := hashPassword("dummy-password-for-timing-parity-only")
	if err != nil {
		panic("auth: precompute dummy hash: " + err.Error())
	}
	return h
}
