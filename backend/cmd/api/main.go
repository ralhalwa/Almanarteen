package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"almanarteen-backend/internal/auth"
	"almanarteen-backend/internal/db"
	"almanarteen-backend/internal/handlers"
	"almanarteen-backend/internal/httpx"
)

func main() {
	dbPath := "./data/app.db"
	_ = os.MkdirAll(filepath.Dir(dbPath), 0755)

	conn, err := db.Open(dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close()

	if err := db.ApplyMigrations(conn, "./migrations"); err != nil {
		log.Fatal(err)
	}

	ah := handlers.AuthHandler{DB: conn}
	ch := handlers.CatalogHandler{DB: conn}
	eh := handlers.ExpensesHandler{DB: conn}

	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ok"))
	})

	// public
	mux.HandleFunc("/auth/login", ah.Login)

	// protected
	mux.Handle("/auth/me", auth.RequireAdmin(conn, http.HandlerFunc(ah.Me)))
	mux.Handle("/auth/logout", auth.RequireAdmin(conn, http.HandlerFunc(ah.Logout)))

	// catalog (protected)
	mux.Handle("/categories", auth.RequireAdmin(conn, http.HandlerFunc(ch.Categories)))
	mux.Handle("/items", auth.RequireAdmin(conn, http.HandlerFunc(ch.Items)))

	// expenses (protected)
	mux.Handle("/expenses", auth.RequireAdmin(conn, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "POST" {
			eh.CreateExpense(w, r)
			return
		}
		if r.Method == "GET" {
			eh.ListExpenses(w, r)
			return
		}
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	})))

	mux.Handle("/budget", auth.RequireAdmin(conn, http.HandlerFunc(eh.SetBudget)))
	mux.Handle("/dashboard/summary", auth.RequireAdmin(conn, http.HandlerFunc(eh.Summary)))

	// ✅ wrap router with CORS (multiple origins)
	handler := httpx.CORS([]string{
		"http://localhost:3000",
		"https://almanarteen-t13d.vercel.app",
	}, mux)

	log.Println("API running on :8080")
	log.Fatal(http.ListenAndServe(":8080", handler))
}
