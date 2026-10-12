package auth

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/starfreck/omnihome-server/internal/model"
	"golang.org/x/crypto/bcrypt"
)

type contextKey string

const userContextKey contextKey = "authUser"

var (
	ErrUserExists    = errors.New("user with this email already exists")
	ErrInvalidCreds  = errors.New("invalid email or password")
	ErrUserNotFound  = errors.New("user not found")
	ErrTokenInvalid  = errors.New("invalid or expired authentication token")
)

// Claims represents the JWT payload.
type Claims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

// AuthService handles user credentials and JWT lifecycle.
type AuthService struct {
	users     map[string]*model.User // email -> User
	usersByID map[string]*model.User // id -> User
	jwtSecret []byte
	mu        sync.RWMutex
}

// NewAuthService initializes the user store and generates/loads the JWT signing key.
func NewAuthService() *AuthService {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "omnihome-cloud-sec-token-99887766-xyz-prod"
	}

	as := &AuthService{
		users:     make(map[string]*model.User),
		usersByID: make(map[string]*model.User),
		jwtSecret: []byte(secret),
	}

	// Seed default administrator / developer tenant
	_, _, _ = as.Register("admin@omnihome.local", "omnihome123", "Admin")

	return as
}

// Register creates a new user account and returns the user object and a JWT token.
func (as *AuthService) Register(email, password, name string) (*model.User, string, error) {
	as.mu.Lock()
	defer as.mu.Unlock()

	normEmail := strings.ToLower(strings.TrimSpace(email))
	if normEmail == "" || len(password) < 6 {
		return nil, "", errors.New("valid email and minimum 6 character password required")
	}

	if _, exists := as.users[normEmail]; exists {
		return nil, "", ErrUserExists
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, "", fmt.Errorf("hashing password: %w", err)
	}

	userID := fmt.Sprintf("usr-%d", time.Now().UnixNano()%1000000)
	if normEmail == "admin@omnihome.local" {
		userID = "usr-admin-default"
	}

	u := &model.User{
		ID:           userID,
		Email:        normEmail,
		PasswordHash: string(hash),
		Name:         name,
		CreatedAt:    time.Now(),
	}

	as.users[normEmail] = u
	as.usersByID[userID] = u

	token, err := as.GenerateToken(u)
	if err != nil {
		return nil, "", err
	}

	return u, token, nil
}

// Login validates user credentials and returns the user object and a new JWT token.
func (as *AuthService) Login(email, password string) (*model.User, string, error) {
	as.mu.RLock()
	normEmail := strings.ToLower(strings.TrimSpace(email))
	u, exists := as.users[normEmail]
	as.mu.RUnlock()

	if !exists {
		return nil, "", ErrInvalidCreds
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
		return nil, "", ErrInvalidCreds
	}

	token, err := as.GenerateToken(u)
	if err != nil {
		return nil, "", err
	}

	return u, token, nil
}

// GenerateToken creates a signed 30-day JWT.
func (as *AuthService) GenerateToken(u *model.User) (string, error) {
	claims := Claims{
		UserID: u.ID,
		Email:  u.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "omnihome-cloud",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(as.jwtSecret)
}

// ValidateToken parses and validates a JWT token string.
func (as *AuthService) ValidateToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return as.jwtSecret, nil
	})

	if err != nil {
		return nil, ErrTokenInvalid
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, ErrTokenInvalid
}

// GetUserByID looks up a user by their unique ID.
func (as *AuthService) GetUserByID(id string) (*model.User, bool) {
	as.mu.RLock()
	defer as.mu.RUnlock()
	u, ok := as.usersByID[id]
	return u, ok
}

// ExtractToken finds JWT from Authorization header or 'token' URL query parameter.
func ExtractToken(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" {
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
			return strings.TrimSpace(parts[1])
		}
	}
	// Fallback to URL query parameter (critical for browser & edge WebSocket handshakes)
	return r.URL.Query().Get("token")
}

// Middleware creates an HTTP middleware that enforces JWT authentication.
func (as *AuthService) Middleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tokenStr := ExtractToken(r)
		if tokenStr == "" {
			http.Error(w, `{"error":"missing authorization token"}`, http.StatusUnauthorized)
			return
		}

		claims, err := as.ValidateToken(tokenStr)
		if err != nil {
			http.Error(w, `{"error":"invalid or expired token"}`, http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), userContextKey, claims)
		next(w, r.WithContext(ctx))
	}
}

// GetUserFromContext extracts the authenticated claims from the request context.
func GetUserFromContext(r *http.Request) (*Claims, bool) {
	claims, ok := r.Context().Value(userContextKey).(*Claims)
	return claims, ok
}
