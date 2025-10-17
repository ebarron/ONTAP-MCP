package mcp

import (
	"sync"
	"time"

	"github.com/ebarron/ONTAP-MCP/pkg/ontap"
	"github.com/ebarron/ONTAP-MCP/pkg/util"
)

// SessionData holds per-session state
type SessionData struct {
	ClusterManager *ontap.ClusterManager
	CreatedAt      time.Time
	LastActivityAt time.Time
}

// SessionManager manages per-session cluster managers for HTTP mode
type SessionManager struct {
	sessions map[string]*SessionData
	mu       sync.RWMutex
	logger   *util.Logger
}

// NewSessionManager creates a new session manager
func NewSessionManager(logger *util.Logger) *SessionManager {
	return &SessionManager{
		sessions: make(map[string]*SessionData),
		logger:   logger,
	}
}

// GetOrCreateSession gets or creates a session with its own cluster manager
func (sm *SessionManager) GetOrCreateSession(sessionID string) *SessionData {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	// Check if session exists
	if session, ok := sm.sessions[sessionID]; ok {
		session.LastActivityAt = time.Now()
		return session
	}

	// Create new session with its own cluster manager
	session := &SessionData{
		ClusterManager: ontap.NewClusterManager(sm.logger),
		CreatedAt:      time.Now(),
		LastActivityAt: time.Now(),
	}

	sm.sessions[sessionID] = session

	sm.logger.Info().
		Str("session_id", sessionID).
		Int("total_sessions", len(sm.sessions)).
		Msg("Created new session with isolated cluster manager")

	return session
}

// GetSession retrieves an existing session
func (sm *SessionManager) GetSession(sessionID string) (*SessionData, bool) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	session, ok := sm.sessions[sessionID]
	if ok {
		session.LastActivityAt = time.Now()
	}
	return session, ok
}

// RemoveSession removes a session
func (sm *SessionManager) RemoveSession(sessionID string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	delete(sm.sessions, sessionID)

	sm.logger.Info().
		Str("session_id", sessionID).
		Int("total_sessions", len(sm.sessions)).
		Msg("Removed session")
}

// SessionCount returns the number of active sessions
func (sm *SessionManager) SessionCount() int {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return len(sm.sessions)
}

// CleanupInactiveSessions removes sessions inactive for longer than the timeout
func (sm *SessionManager) CleanupInactiveSessions(timeout time.Duration) int {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	now := time.Now()
	removed := 0

	for sessionID, session := range sm.sessions {
		if now.Sub(session.LastActivityAt) > timeout {
			delete(sm.sessions, sessionID)
			removed++
			sm.logger.Info().
				Str("session_id", sessionID).
				Dur("inactive_duration", now.Sub(session.LastActivityAt)).
				Msg("Cleaned up inactive session")
		}
	}

	return removed
}
