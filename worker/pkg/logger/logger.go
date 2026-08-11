package logger

import (
	"fmt"
	"log"
	"os"
	"time"
)

// Logger levels
const (
	LevelInfo  = "INFO"
	LevelWarn  = "WARN"
	LevelError = "ERROR"
)

var (
	infoLogger  = log.New(os.Stdout, "", 0)
	warnLogger  = log.New(os.Stdout, "", 0)
	errorLogger = log.New(os.Stderr, "", 0)
)

func format(level, msg string) string {
	return fmt.Sprintf("[%s] [%s] %s", time.Now().Format("2006-01-02 15:04:05"), level, msg)
}

// Info logs informational messages.
func Info(msg string) {
	infoLogger.Println(format(LevelInfo, msg))
}

// Infof logs a formatted informational message.
func Infof(template string, args ...any) {
	Info(fmt.Sprintf(template, args...))
}

// Warn logs warning messages.
func Warn(msg string) {
	warnLogger.Println(format(LevelWarn, msg))
}

// Warnf logs a formatted warning message.
func Warnf(template string, args ...any) {
	Warn(fmt.Sprintf(template, args...))
}

// Error logs error messages to stderr.
func Error(msg string) {
	errorLogger.Println(format(LevelError, msg))
}

// Errorf logs a formatted error message.
func Errorf(template string, args ...any) {
	Error(fmt.Sprintf(template, args...))
}
