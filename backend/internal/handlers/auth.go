package handlers

import (
	"database/sql"
	"net/http"

	"almanarteen-backend/internal/auth"
	"almanarteen-backend/internal/httpx"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct{ DB *sql.DB }

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.JSON(w, 400, map[string]string{"error": "invalid json"})
		return
	}

	var id, name, hash string
	err := h.DB.QueryRow(`SELECT id, name, password_hash FROM users WHERE email = ?`, req.Email).Scan(&id, &name, &hash)
	if err != nil {
		httpx.JSON(w, 401, map[string]string{"error": "invalid credentials"})
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)) != nil {
		httpx.JSON(w, 401, map[string]string{"error": "invalid credentials"})
		return
	}

	sid, exp, err := auth.CreateSession(h.DB, id, 14)
	if err != nil {
		httpx.JSON(w, 500, map[string]string{"error": "failed to create session"})
		return
	}
	auth.SetSessionCookie(w, sid, exp)
	httpx.JSON(w, 200, map[string]any{"id": id, "name": name})
}

func (h AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserIDFromContext(r)
	httpx.JSON(w, 200, map[string]string{"userId": uid})
}

func (h AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	c, _ := r.Cookie(auth.CookieName)
	if c != nil && c.Value != "" {
		_, _ = h.DB.Exec(`DELETE FROM sessions WHERE id = ?`, c.Value)
	}
	auth.ClearSessionCookie(w)
	httpx.JSON(w, 200, map[string]string{"ok": "true"})
}
