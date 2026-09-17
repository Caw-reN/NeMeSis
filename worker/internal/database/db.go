package database

import (
	"database/sql"
	"fmt"

	_ "github.com/go-sql-driver/mysql"

	"github.com/Caw-reN/NeMeSis/worker/internal/config"
	"github.com/Caw-reN/NeMeSis/worker/pkg/logger"
)

// DB is the shared database connection pool.
var DB *sql.DB

// Connect initializes the MySQL connection pool using the provided config.
func Connect(cfg *config.Config) error {
	db, err := sql.Open("mysql", cfg.DSN())
	if err != nil {
		return fmt.Errorf("failed to open db connection: %w", err)
	}

	// Test the connection
	if err := db.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	// Connection pool settings
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)

	DB = db
	logger.Info("Database connection established.")
	return nil
}

// Close closes the database connection pool.
func Close() {
	if DB != nil {
		_ = DB.Close()
	}
}

// GetSetting retrieves a setting value from the settings table by key.
func GetSetting(key string) (string, error) {
	var value sql.NullString
	query := "SELECT value FROM settings WHERE `key` = ? LIMIT 1"
	err := DB.QueryRow(query, key).Scan(&value)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", nil // Not found, return empty string
		}
		return "", err
	}
	if value.Valid {
		return value.String, nil
	}
	return "", nil
}
