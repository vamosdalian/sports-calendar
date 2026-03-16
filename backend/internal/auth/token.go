package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/vamosdalian/sports-calendar/backend/internal/domain"
)

var ErrInvalidToken = errors.New("invalid token")

type tokenPayload struct {
	Email string `json:"email"`
	Exp   int64  `json:"exp"`
}

type Manager struct {
	secret []byte
	ttl    time.Duration
}

func NewManager(secret string, ttl time.Duration) (*Manager, error) {
	if strings.TrimSpace(secret) == "" {
		return nil, fmt.Errorf("auth secret is required")
	}
	if ttl <= 0 {
		return nil, fmt.Errorf("auth ttl must be positive")
	}
	return &Manager{secret: []byte(secret), ttl: ttl}, nil
}

func (m *Manager) Sign(email string, now time.Time) (domain.AuthToken, error) {
	payload := tokenPayload{Email: strings.TrimSpace(strings.ToLower(email)), Exp: now.Add(m.ttl).Unix()}
	rawPayload, err := json.Marshal(payload)
	if err != nil {
		return domain.AuthToken{}, fmt.Errorf("marshal token payload: %w", err)
	}
	encodedPayload := base64.RawURLEncoding.EncodeToString(rawPayload)
	signature := sign(encodedPayload, m.secret)
	token := encodedPayload + "." + signature
	return domain.AuthToken{Token: token, Email: payload.Email, ExpiresAt: time.Unix(payload.Exp, 0).UTC().Format(time.RFC3339)}, nil
}

func (m *Manager) Verify(token string, now time.Time) (domain.TokenClaims, error) {
	parts := strings.Split(strings.TrimSpace(token), ".")
	if len(parts) != 2 {
		return domain.TokenClaims{}, ErrInvalidToken
	}
	expectedSignature := sign(parts[0], m.secret)
	if !hmac.Equal([]byte(parts[1]), []byte(expectedSignature)) {
		return domain.TokenClaims{}, ErrInvalidToken
	}
	rawPayload, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return domain.TokenClaims{}, ErrInvalidToken
	}
	var payload tokenPayload
	if err := json.Unmarshal(rawPayload, &payload); err != nil {
		return domain.TokenClaims{}, ErrInvalidToken
	}
	if strings.TrimSpace(payload.Email) == "" || payload.Exp <= 0 {
		return domain.TokenClaims{}, ErrInvalidToken
	}
	if now.Unix() >= payload.Exp {
		return domain.TokenClaims{}, ErrInvalidToken
	}
	return domain.TokenClaims{Email: payload.Email, ExpiresAt: payload.Exp}, nil
}

func sign(payload string, secret []byte) string {
	hasher := hmac.New(sha256.New, secret)
	_, _ = hasher.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString(hasher.Sum(nil))
}
