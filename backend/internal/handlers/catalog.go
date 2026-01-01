package handlers

import (
	"database/sql"
	"net/http"

	"almanarteen-backend/internal/auth"
	"almanarteen-backend/internal/httpx"
)

type CatalogHandler struct{ DB *sql.DB }

func (h CatalogHandler) Categories(w http.ResponseWriter, r *http.Request) {
	_ = auth.UserIDFromContext(r) // ensure protected middleware passed

	rows, err := h.DB.Query(`SELECT id, name FROM categories ORDER BY name`)
	if err != nil {
		httpx.JSON(w, 500, map[string]string{"error": "db error"})
		return
	}
	defer rows.Close()

	type Cat struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	var out []Cat
	for rows.Next() {
		var c Cat
		if err := rows.Scan(&c.ID, &c.Name); err == nil {
			out = append(out, c)
		}
	}
	httpx.JSON(w, 200, out)
}

func (h CatalogHandler) Items(w http.ResponseWriter, r *http.Request) {
	_ = auth.UserIDFromContext(r)

	categoryID := r.URL.Query().Get("categoryId")
	if categoryID == "" {
		httpx.JSON(w, 400, map[string]string{"error": "categoryId is required"})
		return
	}

	rows, err := h.DB.Query(`
		SELECT id, name, unit
		FROM items
		WHERE category_id = ?
		ORDER BY name
	`, categoryID)
	if err != nil {
		httpx.JSON(w, 500, map[string]string{"error": "db error"})
		return
	}
	defer rows.Close()

	type Item struct {
		ID   string `json:"id"`
		Name string `json:"name"`
		Unit string `json:"unit"`
	}
	var out []Item
	for rows.Next() {
		var it Item
		if err := rows.Scan(&it.ID, &it.Name, &it.Unit); err == nil {
			out = append(out, it)
		}
	}
	httpx.JSON(w, 200, out)
}
