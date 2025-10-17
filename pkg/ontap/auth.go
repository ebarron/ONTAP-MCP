package ontap

import (
	"crypto/tls"
	"encoding/base64"
	"net/http"
)

// AuthConfig holds authentication configuration
type AuthConfig struct {
	Username string
	Password string
}

// CreateBasicAuth creates a basic auth header value
func CreateBasicAuth(username, password string) string {
	auth := username + ":" + password
	return base64.StdEncoding.EncodeToString([]byte(auth))
}

// CreateHTTPClient creates an HTTP client with TLS configuration
func CreateHTTPClient(insecureSkipVerify bool) *http.Client {
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: insecureSkipVerify,
		},
		MaxIdleConns:        10,
		MaxIdleConnsPerHost: 10,
		IdleConnTimeout:     90,
	}

	return &http.Client{
		Transport: transport,
		Timeout:   30,
	}
}
