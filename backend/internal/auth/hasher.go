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
