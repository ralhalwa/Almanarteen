package handlers

import (
	"database/sql"
	"math"
	"net/http"
	"time"

	"almanarteen-backend/internal/auth"
	"almanarteen-backend/internal/httpx"

	"github.com/google/uuid"
)

type ExpensesHandler struct{ DB *sql.DB }

type createExpenseReq struct {
	Date      string  `json:"date"` // YYYY-MM-DD
	ItemID    string  `json:"itemId"`
	Quantity  float64 `json:"quantity"`
	UnitPrice float64 `json:"unitPrice"`
	Note      string  `json:"note"`
}

func round2(x float64) float64 { return math.Round(x*100) / 100 }

func (h ExpensesHandler) CreateExpense(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r)

	var req createExpenseReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.JSON(w, 400, map[string]string{"error": "invalid json"})
		return
	}

	if req.Date == "" || req.ItemID == "" || req.Quantity <= 0 || req.UnitPrice <= 0 {
		httpx.JSON(w, 400, map[string]string{"error": "missing/invalid fields"})
		return
	}

	if _, err := time.Parse("2006-01-02", req.Date); err != nil {
		httpx.JSON(w, 400, map[string]string{"error": "date must be YYYY-MM-DD"})
		return
	}

	total := round2(req.Quantity * req.UnitPrice)

	id := uuid.NewString()
	_, err := h.DB.Exec(`
		INSERT INTO expenses (id, purchase_date, item_id, quantity, unit_price, total_price, note, created_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, id, req.Date, req.ItemID, req.Quantity, req.UnitPrice, total, req.Note, userID)
	if err != nil {
		httpx.JSON(w, 500, map[string]string{"error": err.Error()})
		return
	}

	httpx.JSON(w, 201, map[string]any{"id": id, "total": total})
}

func (h ExpensesHandler) ListExpenses(w http.ResponseWriter, r *http.Request) {
	_ = auth.UserIDFromContext(r)

	month := r.URL.Query().Get("month") // YYYY-MM
	if month == "" {
		httpx.JSON(w, 400, map[string]string{"error": "month is required (YYYY-MM)"})
		return
	}
	if _, err := time.Parse("2006-01", month); err != nil {
		httpx.JSON(w, 400, map[string]string{"error": "month must be YYYY-MM"})
		return
	}

	categoryID := r.URL.Query().Get("categoryId")

	query := `
		SELECT 
			e.id,
			e.purchase_date,
			c.id,
			c.name,
			i.name,
			i.unit,
			e.quantity,
			e.unit_price,
			e.total_price,
			e.note,
			u.name
		FROM expenses e
		JOIN items i ON i.id = e.item_id
		JOIN categories c ON c.id = i.category_id
		JOIN users u ON u.id = e.created_by
		WHERE substr(e.purchase_date,1,7) = ?
	`
	args := []any{month}

	if categoryID != "" {
		query += ` AND c.id = ? `
		args = append(args, categoryID)
	}

	query += ` ORDER BY e.purchase_date DESC, e.created_at DESC`

	rows, err := h.DB.Query(query, args...)
	if err != nil {
		httpx.JSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	type Row struct {
		ID         string  `json:"id"`
		Date       string  `json:"date"`
		CategoryID string  `json:"categoryId"`
		Category   string  `json:"category"`
		Item       string  `json:"item"`
		Unit       string  `json:"unit"`
		Quantity   float64 `json:"quantity"`
		UnitPrice  float64 `json:"unitPrice"`
		Total      float64 `json:"total"`
		Note       string  `json:"note"`
		CreatedBy  string  `json:"createdBy"`
	}

	out := []Row{}
	for rows.Next() {
		var x Row
		if err := rows.Scan(
			&x.ID,
			&x.Date,
			&x.CategoryID,
			&x.Category,
			&x.Item,
			&x.Unit,
			&x.Quantity,
			&x.UnitPrice,
			&x.Total,
			&x.Note,
			&x.CreatedBy,
		); err != nil {
			httpx.JSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		out = append(out, x)
	}

	httpx.JSON(w, 200, out)
}



type setBudgetReq struct {
	Month     string  `json:"month"`     // YYYY-MM
	MaxBudget float64 `json:"maxBudget"` // BD
}

func (h ExpensesHandler) SetBudget(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r)

	var req setBudgetReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.JSON(w, 400, map[string]string{"error": "invalid json"})
		return
	}
	if req.Month == "" || req.MaxBudget <= 0 {
		httpx.JSON(w, 400, map[string]string{"error": "missing/invalid fields"})
		return
	}
	if _, err := time.Parse("2006-01", req.Month); err != nil {
		httpx.JSON(w, 400, map[string]string{"error": "month must be YYYY-MM"})
		return
	}

	monthDate := req.Month + "-01"

	_, err := h.DB.Exec(`
		INSERT INTO monthly_budgets (id, month, max_budget, created_by)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(month) DO UPDATE SET max_budget=excluded.max_budget, created_by=excluded.created_by
	`, uuid.NewString(), monthDate, round2(req.MaxBudget), userID)
	if err != nil {
		httpx.JSON(w, 500, map[string]string{"error": err.Error()})
		return
	}

	httpx.JSON(w, 200, map[string]any{"ok": true})
}

func (h ExpensesHandler) Summary(w http.ResponseWriter, r *http.Request) {
	_ = auth.UserIDFromContext(r)

	month := r.URL.Query().Get("month") // YYYY-MM
	if month == "" {
		httpx.JSON(w, 400, map[string]string{"error": "month is required (YYYY-MM)"})
		return
	}
	if _, err := time.Parse("2006-01", month); err != nil {
		httpx.JSON(w, 400, map[string]string{"error": "month must be YYYY-MM"})
		return
	}

	var total float64
	if err := h.DB.QueryRow(`
		SELECT COALESCE(SUM(total_price),0)
		FROM expenses
		WHERE substr(purchase_date,1,7)=?
	`, month).Scan(&total); err != nil {
		httpx.JSON(w, 500, map[string]string{"error": err.Error()})
		return
	}

	monthDate := month + "-01"

	var budget sql.NullFloat64
	if err := h.DB.QueryRow(`SELECT max_budget FROM monthly_budgets WHERE month=?`, monthDate).Scan(&budget); err != nil && err != sql.ErrNoRows {
		httpx.JSON(w, 500, map[string]string{"error": err.Error()})
		return
	}

	// ✅ include categoryId so frontend can navigate
	rows, err := h.DB.Query(`
		SELECT c.id, c.name, COALESCE(SUM(e.total_price),0) as cat_total
		FROM expenses e
		JOIN items i ON i.id = e.item_id
		JOIN categories c ON c.id = i.category_id
		WHERE substr(e.purchase_date,1,7) = ?
		GROUP BY c.id, c.name
		ORDER BY cat_total DESC
	`, month)
	if err != nil {
		httpx.JSON(w, 500, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	type Cat struct {
		CategoryID string  `json:"categoryId"`
		Category   string  `json:"category"`
		Total      float64 `json:"total"`
	}

	var cats []Cat
	for rows.Next() {
		var c Cat
		if err := rows.Scan(&c.CategoryID, &c.Category, &c.Total); err != nil {
			httpx.JSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		cats = append(cats, c)
	}

	if cats == nil {
		cats = []Cat{}
	}

	resp := map[string]any{
		"month": month,
		"total": round2(total),
		"budget": func() any {
			if budget.Valid {
				return round2(budget.Float64)
			}
			return nil
		}(),
		"overBudget": func() bool {
			return budget.Valid && total > budget.Float64
		}(),
		"byCategory": cats,
	}

	httpx.JSON(w, 200, resp)
}
