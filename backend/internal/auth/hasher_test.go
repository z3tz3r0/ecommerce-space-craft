package auth

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// dummyHash is precomputed at package init via mustComputeDummyHash and used
// by Service.Login on the user-not-found path to keep response time symmetric.
// These tests assert the hash is well-formed and that comparing against it
// behaves like comparing against any real argon2id hash — failed match,
// constant-time, no error.

func TestDummyHash_HasArgon2idPrefix(t *testing.T) {
	require.True(t, strings.HasPrefix(dummyHash, "$argon2id$"),
		"dummyHash must be a real argon2id hash so verifyPassword spends real CPU")
}

func TestDummyHash_VerifyAgainstArbitraryPassword_ReturnsFalseNoError(t *testing.T) {
	// We don't care about the boolean — the point is that calling
	// verifyPassword consumes the same time as a real verify. Assert it
	// completes cleanly so the timing-defence path can ignore the result.
	ok, err := verifyPassword("anything-the-attacker-might-send", dummyHash)
	require.NoError(t, err, "verify against dummyHash must not error so Login can _, _ = ignore the result")
	require.False(t, ok, "dummyHash hashes a fixed sentinel password — must not match arbitrary input")
}
