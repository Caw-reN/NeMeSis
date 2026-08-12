package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// Config holds all configuration loaded from environment variables.
type Config struct {
	// Database
	DBHost     string
	DBPort     string
	DBName     string
	DBUser     string
	DBPassword string

	// Worker behavior
	PollIntervalSeconds int // How often to poll devices (default: 60)
	WorkerPoolSize      int // Max concurrent scan goroutines (default: 50)
}

// DSN returns the MySQL Data Source Name string for go-sql-driver.
func (c *Config) DSN() string {
	return fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true&timeout=5s",
		c.DBUser, c.DBPassword, c.DBHost, c.DBPort, c.DBName,
	)
}

// Load reads configuration from a .env file (if present) and environment variables.
// Environment variables always take precedence over .env file.
func Load() (*Config, error) {
	// Load .env file if it exists — ignore error if file not found (use system env)
	_ = godotenv.Load()

	cfg := &Config{
		DBHost:     getEnv("DB_HOST", "127.0.0.1"),
		DBPort:     getEnv("DB_PORT", "3306"),
		DBName:     getEnv("DB_NAME", "nms_db"),
		DBUser:     getEnv("DB_USER", "nms_user"),
		DBPassword: getEnv("DB_PASSWORD", "secret"),

		PollIntervalSeconds: getEnvInt("POLL_INTERVAL_SECONDS", 60),
		WorkerPoolSize:      getEnvInt("WORKER_POOL_SIZE", 50),
	}

	return cfg, nil
}

func getEnv(key, defaultVal string) string {
	if val, exists := os.LookupEnv(key); exists {
		return val
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if val := os.Getenv(key); val != "" {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return defaultVal
}
