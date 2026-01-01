package auth

import (
	"context"
	"database/sql"
	"net/http"
	"time"
)

type ctxKey string

const CtxUserID ctxKey = "userID"

func RequireAdmin(conn *sql.DB, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie(CookieName)
		if err != nil || c.Value == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		var userID, role string
		var expires time.Time
		err = conn.QueryRow(`
			SELECT u.id, u.role, s.expires_at
			FROM sessions s
			JOIN users u ON u.id = s.user_id
			WHERE s.id = ?
		`, c.Value).Scan(&userID, &role, &expires)
		if err != nil || role != "admin" || time.Now().After(expires) {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), CtxUserID, userID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func UserIDFromContext(r *http.Request) string {
	if v := r.Context().Value(CtxUserID); v != nil {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}
