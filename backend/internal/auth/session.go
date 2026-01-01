package auth

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/google/uuid"
)

const CookieName = "almanarteen_session"

func CreateSession(conn *sql.DB, userID string, days int) (string, time.Time, error) {
	sid := uuid.NewString()
	exp := time.Now().Add(time.Hour * 24 * time.Duration(days))

	_, err := conn.Exec(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`, sid, userID, exp.UTC())
	if err != nil {
		return "", time.Time{}, err
	}
	return sid, exp, nil
}

func SetSessionCookie(w http.ResponseWriter, sid string, exp time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    sid,
		Path:     "/",
		Expires:  exp,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   false, // set true in production HTTPS
	})
}

func ClearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   false,
	})
}
