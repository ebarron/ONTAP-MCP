package util

import (
	"io"
	"os"
	"strings"
	"time"

	"github.com/rs/zerolog"
)

// Logger wraps zerolog for structured logging
type Logger struct {
	*zerolog.Logger
}

// NewLogger creates a new logger with the specified level
func NewLogger(level string) *Logger {
	// Configure zerolog
	output := zerolog.ConsoleWriter{
		Out:        os.Stderr,
		TimeFormat: time.RFC3339,
	}

	// Parse log level
	logLevel := zerolog.InfoLevel
	switch strings.ToLower(level) {
	case "debug":
		logLevel = zerolog.DebugLevel
	case "info":
		logLevel = zerolog.InfoLevel
	case "warn", "warning":
		logLevel = zerolog.WarnLevel
	case "error":
		logLevel = zerolog.ErrorLevel
	}

	zerologger := zerolog.New(output).
		Level(logLevel).
		With().
		Timestamp().
		Logger()

	return &Logger{Logger: &zerologger}
}

// NewTestLogger creates a logger that discards output (for tests)
func NewTestLogger() *Logger {
	zerologger := zerolog.New(io.Discard).Level(zerolog.Disabled)
	return &Logger{Logger: &zerologger}
}
