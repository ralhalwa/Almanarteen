package httpx

import (
	"net/http"
	"strings"
)

// allowOrigin returns true if origin is allowed.
// This supports:
// - localhost:3000
// - your production domain(s)
// - ANY vercel preview domain for your project (prefix match)
func allowOrigin(origin string, allowedExact []string, vercelProjectPrefix string) bool {
	if origin == "" {
		return false
	}

	// exact allow-list
	for _, o := range allowedExact {
		if origin == o {
			return true
		}
	}

	// allow all preview domains for your Vercel project
	// example: https://almanarteen-t13d-git-main-xxxx.vercel.app
	if vercelProjectPrefix != "" &&
		strings.HasPrefix(origin, "https://"+vercelProjectPrefix) &&
		strings.HasSuffix(origin, ".vercel.app") {
		return true
	}

	return false
}

func CORS(allowedExact []string, vercelProjectPrefix string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		if allowOrigin(origin, allowedExact, vercelProjectPrefix) {
			// MUST be the request origin (not "*") because credentials/cookies
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		}

		// Preflight
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
