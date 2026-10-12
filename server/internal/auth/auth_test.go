package auth

import (
	"testing"
)

func TestAuthService(t *testing.T) {
	as := NewAuthService()

	// 1. Default seeded admin exists and can login
	u, token, err := as.Login("admin@omnihome.local", "omnihome123")
	if err != nil {
		t.Fatalf("failed to login as seeded admin: %v", err)
	}
	if u.Email != "admin@omnihome.local" || token == "" {
		t.Fatalf("invalid login response: user=%v, token=%s", u, token)
	}

	// 2. Token validation
	claims, err := as.ValidateToken(token)
	if err != nil {
		t.Fatalf("failed to validate generated token: %v", err)
	}
	if claims.Email != "admin@omnihome.local" {
		t.Fatalf("expected admin email in claims, got %s", claims.Email)
	}

	// 3. Register new user
	newUser, newToken, err := as.Register("testuser@example.com", "securepass123", "Test User")
	if err != nil {
		t.Fatalf("failed to register new user: %v", err)
	}
	if newUser.Email != "testuser@example.com" || newToken == "" {
		t.Fatalf("invalid registration response")
	}

	// 4. Duplicate registration rejected
	if _, _, err := as.Register("testuser@example.com", "anotherpass", "Test User"); err != ErrUserExists {
		t.Fatalf("expected ErrUserExists, got %v", err)
	}

	// 5. Wrong password rejected
	if _, _, err := as.Login("testuser@example.com", "wrongpassword"); err != ErrInvalidCreds {
		t.Fatalf("expected ErrInvalidCreds, got %v", err)
	}

	// 6. Fake/Tampered token rejected (Anti-MITM)
	if _, err := as.ValidateToken("fake.tampered.token"); err != ErrTokenInvalid {
		t.Fatalf("expected ErrTokenInvalid for tampered token, got %v", err)
	}
}
