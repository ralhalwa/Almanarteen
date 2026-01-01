package main

import (
	"database/sql"
	"log"
	"os"
	"path/filepath"
	"time"

	"almanarteen-backend/internal/db"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type Category struct {
	Name  string
	Items []Item
}
type Item struct {
	Name string
	Unit string // kg, pcs, pack, liter, etc.
}

func main() {
	dbPath := "./data/app.db"
	_ = os.MkdirAll(filepath.Dir(dbPath), 0755)

	conn, err := db.Open(dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close()

	// Ensure migrations applied (safe)
	if err := db.ApplyMigrations(conn, "./migrations"); err != nil {
		log.Fatal(err)
	}

	// 1) Seed admins
	admin1Email := "admin1@almanarteen.local"
	admin2Email := "admin2@almanarteen.local"
	adminPass := "Admin@12345" // change after first login

	seedAdmin(conn, "Admin One", admin1Email, adminPass)
	seedAdmin(conn, "Admin Two", admin2Email, adminPass)

	// 2) Seed categories + items
	cats := defaultRestaurantCatalog()
	for _, c := range cats {
		catID := seedCategory(conn, c.Name)
		for _, it := range c.Items {
			seedItem(conn, catID, it.Name, it.Unit)
		}
	}

	// 3) Seed current month budget (optional starter)
	// You can comment this out if you want budget set from UI
	monthStart := time.Now().Format("2006-01-01")
	log.Println("Seed complete ✅ (month start example:", monthStart, ")")
}

func seedAdmin(conn *sql.DB, name, email, password string) {
	// If exists, skip
	var exists int
	_ = conn.QueryRow(`SELECT COUNT(1) FROM users WHERE email = ?`, email).Scan(&exists)
	if exists > 0 {
		log.Println("Admin exists, skip:", email)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatal(err)
	}

	_, err = conn.Exec(`
		INSERT INTO users (id, name, email, password_hash, role)
		VALUES (?, ?, ?, ?, 'admin')
	`, uuid.NewString(), name, email, string(hash))
	if err != nil {
		log.Fatal(err)
	}
	log.Println("Seeded admin:", email, "password:", password)
}

func seedCategory(conn *sql.DB, name string) string {
	var id string
	err := conn.QueryRow(`SELECT id FROM categories WHERE name = ?`, name).Scan(&id)
	if err == nil {
		return id
	}
	if err != sql.ErrNoRows {
		log.Fatal(err)
	}

	id = uuid.NewString()
	_, err = conn.Exec(`INSERT INTO categories (id, name) VALUES (?, ?)`, id, name)
	if err != nil {
		log.Fatal(err)
	}
	return id
}

func seedItem(conn *sql.DB, categoryID, name, unit string) {
	// skip if exists
	var exists int
	_ = conn.QueryRow(`SELECT COUNT(1) FROM items WHERE category_id = ? AND name = ?`, categoryID, name).Scan(&exists)
	if exists > 0 {
		return
	}

	_, err := conn.Exec(`
		INSERT INTO items (id, category_id, name, unit)
		VALUES (?, ?, ?, ?)
	`, uuid.NewString(), categoryID, name, unit)
	if err != nil {
		log.Fatal(err)
	}
}

func defaultRestaurantCatalog() []Category {
	return []Category{
		{
			Name: "Chicken",
			Items: []Item{
				{"Whole Chicken", "kg"},
				{"Chicken Breast", "kg"},
				{"Chicken Thigh", "kg"},
				{"Chicken Wings", "kg"},
			},
		},
		{
			Name: "Beef",
			Items: []Item{
				{"Beef Mince", "kg"},
				{"Beef Cubes", "kg"},
				{"Beef Ribs", "kg"},
			},
		},
		{
			Name: "Fish & Seafood",
			Items: []Item{
				{"Hamour", "kg"},
				{"Shrimp", "kg"},
				{"Salmon", "kg"},
				{"Tuna", "kg"},
			},
		},
		{
			Name: "Rice & Grains",
			Items: []Item{
				{"Basmati Rice", "kg"},
				{"Short Grain Rice", "kg"},
				{"Flour", "kg"},
			},
		},
		{
			Name: "Spices",
			Items: []Item{
				{"Cumin", "kg"},
				{"Turmeric", "kg"},
				{"Black Pepper", "kg"},
				{"Cardamom", "kg"},
				{"Cinnamon", "kg"},
				{"Mixed Majboos Spices", "kg"},
			},
		},
		{
			Name: "Vegetables",
			Items: []Item{
				{"Onion", "kg"},
				{"Tomato", "kg"},
				{"Potato", "kg"},
				{"Garlic", "kg"},
				{"Lemon", "kg"},
			},
		},
		{
			Name: "Oils & Sauces",
			Items: []Item{
				{"Cooking Oil", "liter"},
				{"Ghee", "kg"},
				{"Tomato Paste", "pack"},
				{"Soy Sauce", "liter"},
			},
		},
		{
			Name: "Dairy",
			Items: []Item{
				{"Milk", "liter"},
				{"Yogurt", "pack"},
				{"Cream", "pack"},
			},
		},
		{
			Name: "Packaging",
			Items: []Item{
				{"Food Containers", "pack"},
				{"Bags", "pack"},
				{"Tissues", "pack"},
				{"Gloves", "pack"},
			},
		},
		{
			Name: "Cleaning",
			Items: []Item{
				{"Dish Soap", "liter"},
				{"Sanitizer", "liter"},
				{"Trash Bags", "pack"},
			},
		},
	}
}
