package ontap

import (
	"errors"
	"fmt"
)

// Common ONTAP API errors
var (
	ErrClusterNotFound    = errors.New("cluster not found")
	ErrUnauthorized       = errors.New("unauthorized - invalid credentials")
	ErrConnectionFailed   = errors.New("connection failed")
	ErrInvalidResponse    = errors.New("invalid API response")
	ErrResourceNotFound   = errors.New("resource not found")
	ErrResourceExists     = errors.New("resource already exists")
	ErrOperationFailed    = errors.New("operation failed")
	ErrInvalidParameter   = errors.New("invalid parameter")
)

// APIError represents an ONTAP REST API error
type APIError struct {
	StatusCode int
	Message    string
	Code       string
	Target     string
}

func (e *APIError) Error() string {
	if e.Code != "" {
		return fmt.Sprintf("API error (HTTP %d): %s (code: %s)", e.StatusCode, e.Message, e.Code)
	}
	return fmt.Sprintf("API error (HTTP %d): %s", e.StatusCode, e.Message)
}

// NewAPIError creates a new API error
func NewAPIError(statusCode int, message, code, target string) *APIError {
	return &APIError{
		StatusCode: statusCode,
		Message:    message,
		Code:       code,
		Target:     target,
	}
}

// IsNotFoundError checks if an error is a "not found" error
func IsNotFoundError(err error) bool {
	if apiErr, ok := err.(*APIError); ok {
		return apiErr.StatusCode == 404
	}
	return errors.Is(err, ErrResourceNotFound)
}

// IsUnauthorizedError checks if an error is an authentication error
func IsUnauthorizedError(err error) bool {
	if apiErr, ok := err.(*APIError); ok {
		return apiErr.StatusCode == 401 || apiErr.StatusCode == 403
	}
	return errors.Is(err, ErrUnauthorized)
}
