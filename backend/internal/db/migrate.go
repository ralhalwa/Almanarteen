package db


import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

func ApplyMigrations(conn *sql.DB, migrationsDir string) error {
	// 1) Create a table to track which migrations ran
	if _, err := conn.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			filename TEXT PRIMARY KEY,
			applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);
	`); err != nil {
		return err
	}

	// 2) List .sql migration files
	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		return err
	}

	var files []string
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if strings.HasSuffix(name, ".sql") {
			files = append(files, name)
		}
	}
	sort.Strings(files)

	// 3) Run only migrations that are not yet recorded
	for _, f := range files {
		var exists int
		if err := conn.QueryRow(`SELECT COUNT(1) FROM schema_migrations WHERE filename = ?`, f).Scan(&exists); err != nil {
			return err
		}
		if exists > 0 {
			continue
		}

		path := filepath.Join(migrationsDir, f)
		sqlBytes, err := os.ReadFile(path)
		if err != nil {
			return err
		}

		tx, err := conn.Begin()
		if err != nil {
			return err
		}

		if _, err := tx.Exec(string(sqlBytes)); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("migration %s failed: %w", f, err)
		}

		if _, err := tx.Exec(`INSERT INTO schema_migrations(filename) VALUES (?)`, f); err != nil {
			_ = tx.Rollback()
			return err
		}

		if err := tx.Commit(); err != nil {
			return err
		}
	}

	return nil
}
