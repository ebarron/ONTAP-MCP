package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Session represents an MCP session
type Session struct {
	ID        string
	CreatedAt time.Time
	mu        sync.RWMutex
	clients   map[chan []byte]bool
}

// SessionManager manages MCP sessions for HTTP transport
type SessionManager struct {
	sessions map[string]*Session
	mu       sync.RWMutex
}

// NewSessionManager creates a new session manager
func NewSessionManager() *SessionManager {
	return &SessionManager{
		sessions: make(map[string]*Session),
	}
}

// CreateSession creates a new session
func (sm *SessionManager) CreateSession() *Session {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	session := &Session{
		ID:        uuid.New().String(),
		CreatedAt: time.Now(),
		clients:   make(map[chan []byte]bool),
	}

	sm.sessions[session.ID] = session
	return session
}

// GetSession retrieves a session by ID
func (sm *SessionManager) GetSession(id string) (*Session, bool) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	session, ok := sm.sessions[id]
	return session, ok
}

// AddClient adds an SSE client to a session
func (s *Session) AddClient(ch chan []byte) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.clients[ch] = true
}

// RemoveClient removes an SSE client from a session
func (s *Session) RemoveClient(ch chan []byte) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.clients, ch)
	close(ch)
}

// Broadcast sends a message to all SSE clients in a session
func (s *Session) Broadcast(data []byte) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for ch := range s.clients {
		select {
		case ch <- data:
		default:
			// Client is slow or disconnected, skip
		}
	}
}

// ServeHTTP runs the MCP server in HTTP/SSE mode (for browser integration)
func (s *Server) ServeHTTP(ctx context.Context, port int) error {
	sessionMgr := NewSessionManager()

	mux := http.NewServeMux()

	// SSE endpoint - establishes connection and sends session ID
	mux.HandleFunc("/mcp", func(w http.ResponseWriter, r *http.Request) {
		s.handleSSE(w, r, sessionMgr)
	})

	// Message endpoint - receives JSON-RPC requests
	mux.HandleFunc("/messages", func(w http.ResponseWriter, r *http.Request) {
		s.handleMessages(ctx, w, r, sessionMgr)
	})

	// Health check endpoint
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	// CORS middleware
	handler := corsMiddleware(mux)

	addr := fmt.Sprintf(":%d", port)
	server := &http.Server{
		Addr:    addr,
		Handler: handler,
	}

	// Graceful shutdown
	go func() {
		<-ctx.Done()
		s.logger.Info().Msg("Shutting down HTTP server...")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		server.Shutdown(shutdownCtx)
	}()

	s.logger.Info().
		Int("port", port).
		Msg("HTTP server listening")

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("HTTP server error: %w", err)
	}

	return nil
}

// handleSSE handles SSE connections
func (s *Server) handleSSE(w http.ResponseWriter, r *http.Request, sessionMgr *SessionManager) {
	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Create session
	session := sessionMgr.CreateSession()

	s.logger.Info().
		Str("session_id", session.ID).
		Msg("New SSE connection established")

	// Send endpoint event with session ID
	fmt.Fprintf(w, "event: endpoint\n")
	fmt.Fprintf(w, "data: %s\n\n", session.ID)
	w.(http.Flusher).Flush()

	// Create client channel
	clientChan := make(chan []byte, 10)
	session.AddClient(clientChan)
	defer session.RemoveClient(clientChan)

	// Keep connection alive and send messages
	for {
		select {
		case <-r.Context().Done():
			s.logger.Debug().
				Str("session_id", session.ID).
				Msg("SSE client disconnected")
			return
		case data := <-clientChan:
			fmt.Fprintf(w, "event: message\n")
			fmt.Fprintf(w, "data: %s\n\n", data)
			w.(http.Flusher).Flush()
		}
	}
}

// handleMessages handles JSON-RPC requests
func (s *Server) handleMessages(ctx context.Context, w http.ResponseWriter, r *http.Request, sessionMgr *SessionManager) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get session ID from query parameter or header
	sessionID := r.URL.Query().Get("sessionId")
	if sessionID == "" {
		sessionID = r.Header.Get("Mcp-Session-Id")
	}

	if sessionID == "" {
		http.Error(w, "Missing session ID", http.StatusBadRequest)
		return
	}

	session, ok := sessionMgr.GetSession(sessionID)
	if !ok {
		http.Error(w, "Invalid session ID", http.StatusNotFound)
		return
	}

	// Parse JSON-RPC request
	var req JSONRPCRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.logger.Error().
			Err(err).
			Msg("Failed to parse JSON-RPC request")

		resp := NewJSONRPCError(nil, ErrCodeParseError, "Parse error", err.Error())
		s.sendResponse(w, session, resp)
		return
	}

	// Handle request
	resp := s.HandleRequest(ctx, &req)

	// Send response
	s.sendResponse(w, session, resp)
}

// sendResponse sends a JSON-RPC response via HTTP and SSE
func (s *Server) sendResponse(w http.ResponseWriter, session *Session, resp *JSONRPCResponse) {
	respBytes, err := json.Marshal(resp)
	if err != nil {
		s.logger.Error().
			Err(err).
			Msg("Failed to marshal response")
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Send via HTTP response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write(respBytes)

	// Also broadcast via SSE
	session.Broadcast(respBytes)
}

// corsMiddleware adds CORS headers
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
