package tools

import (
	"fmt"
	"strings"
)

// Parameter extraction utilities to prevent unsafe type assertions
// All tools should use these helpers instead of direct type assertions

// getStringParam safely retrieves a string parameter with nil checking
func getStringParam(args map[string]interface{}, paramName string, required bool) (string, error) {
	val, exists := args[paramName]
	if !exists || val == nil {
		if required {
			return "", fmt.Errorf("missing required parameter: %s", paramName)
		}
		return "", nil
	}
	strVal, ok := val.(string)
	if !ok {
		return "", fmt.Errorf("parameter %s must be a string, got %T", paramName, val)
	}
	return strVal, nil
}

// getBoolParam safely retrieves a boolean parameter with nil checking
func getBoolParam(args map[string]interface{}, paramName string, required bool) (bool, error) {
	val, exists := args[paramName]
	if !exists || val == nil {
		if required {
			return false, fmt.Errorf("missing required parameter: %s", paramName)
		}
		return false, nil
	}
	boolVal, ok := val.(bool)
	if !ok {
		return false, fmt.Errorf("parameter %s must be a boolean, got %T", paramName, val)
	}
	return boolVal, nil
}

// getIntParam safely retrieves an integer parameter with nil checking
func getIntParam(args map[string]interface{}, paramName string, required bool) (int, error) {
	val, exists := args[paramName]
	if !exists || val == nil {
		if required {
			return 0, fmt.Errorf("missing required parameter: %s", paramName)
		}
		return 0, nil
	}

	// Handle both int and float64 (JSON numbers come as float64)
	switch v := val.(type) {
	case int:
		return v, nil
	case float64:
		return int(v), nil
	case int64:
		return int(v), nil
	default:
		return 0, fmt.Errorf("parameter %s must be a number, got %T", paramName, val)
	}
}

// getFloat64Param safely retrieves a float64 parameter with nil checking
func getFloat64Param(args map[string]interface{}, paramName string, required bool) (float64, error) {
	val, exists := args[paramName]
	if !exists || val == nil {
		if required {
			return 0, fmt.Errorf("missing required parameter: %s", paramName)
		}
		return 0, nil
	}

	// Handle both float64 and int (convert int to float64)
	switch v := val.(type) {
	case float64:
		return v, nil
	case int:
		return float64(v), nil
	case int64:
		return float64(v), nil
	default:
		return 0, fmt.Errorf("parameter %s must be a number, got %T", paramName, val)
	}
}

// getStringSliceParam safely retrieves a string slice parameter with nil checking
func getStringSliceParam(args map[string]interface{}, paramName string, required bool) ([]string, error) {
	val, exists := args[paramName]
	if !exists || val == nil {
		if required {
			return nil, fmt.Errorf("missing required parameter: %s", paramName)
		}
		return nil, nil
	}

	// Handle []interface{} from JSON and convert to []string
	switch v := val.(type) {
	case []string:
		return v, nil
	case []interface{}:
		result := make([]string, len(v))
		for i, item := range v {
			strItem, ok := item.(string)
			if !ok {
				return nil, fmt.Errorf("parameter %s[%d] must be a string, got %T", paramName, i, item)
			}
			result[i] = strItem
		}
		return result, nil
	default:
		return nil, fmt.Errorf("parameter %s must be a string array, got %T", paramName, val)
	}
}

// getMapParam safely retrieves a map parameter with nil checking
func getMapParam(args map[string]interface{}, paramName string, required bool) (map[string]interface{}, error) {
	val, exists := args[paramName]
	if !exists || val == nil {
		if required {
			return nil, fmt.Errorf("missing required parameter: %s", paramName)
		}
		return nil, nil
	}
	mapVal, ok := val.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("parameter %s must be an object, got %T", paramName, val)
	}
	return mapVal, nil
}

// parseSizeString parses size strings in multiple formats:
// - Raw bytes: "104857600" → 100MB
// - With units: "100MB", "2GB", "1TB"
// - Short units: "100M", "2G", "1T"
// - Case insensitive: "100mb", "2gb", etc.
// Returns size in bytes, or error if format is invalid.
func parseSizeString(sizeStr string) (int64, error) {
	if sizeStr == "" {
		return 0, fmt.Errorf("size string is empty")
	}

	sizeStr = strings.TrimSpace(sizeStr)

	// Try parsing as raw number (bytes) first
	var sizeBytes int64
	if num, err := fmt.Sscanf(sizeStr, "%d", &sizeBytes); err == nil && num == 1 {
		// Successfully parsed as raw bytes
		return sizeBytes, nil
	}

	// Parse with unit suffix (e.g., "100MB", "2GB", "100M", "2G")
	var num float64
	var unit string

	// Try parsing "100MB", "100GB", "100TB" format
	if n, err := fmt.Sscanf(sizeStr, "%f%s", &num, &unit); err == nil && n == 2 {
		// Normalize unit to uppercase
		unit = strings.ToUpper(unit)

		switch unit {
		case "KB", "K":
			return int64(num * 1024), nil
		case "MB", "M":
			return int64(num * 1024 * 1024), nil
		case "GB", "G":
			return int64(num * 1024 * 1024 * 1024), nil
		case "TB", "T":
			return int64(num * 1024 * 1024 * 1024 * 1024), nil
		default:
			return 0, fmt.Errorf("invalid size unit '%s'. Supported: KB, MB, GB, TB (or K, M, G, T), or raw bytes", unit)
		}
	}

	return 0, fmt.Errorf("invalid size format '%s'. Use '100MB', '2GB', '1TB', or raw bytes", sizeStr)
}
