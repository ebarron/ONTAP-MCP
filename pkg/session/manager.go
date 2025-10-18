package session

import (
	"fmt"
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

// Global singleton SessionManager instance
// Tools access this directly to get their session's cluster manager
var globalSessionManager *SessionManager
var sessionManagerOnce sync.Once

// GetGlobalSessionManager returns the global SessionManager singleton
// This is safe to call from anywhere, including tools
func GetGlobalSessionManager() *SessionManager {
	return globalSessionManager
}

// InitializeGlobalSessionManager sets up the global SessionManager
// Should be called once during server startup
func InitializeGlobalSessionManager(logger *util.Logger) {
	sessionManagerOnce.Do(func() {
		globalSessionManager = &SessionManager{
			sessions: make(map[string]*SessionData),
			logger:   logger,
		}
		logger.Info().Msg("Initialized global SessionManager singleton")
	})
}

// NewSessionManager creates a new session manager (legacy - use InitializeGlobalSessionManager instead)
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

	sm.logger.Info().
		Str("session_id", sessionID).
		Str("session_id_empty", fmt.Sprintf("%v", sessionID == "")).
		Int("current_sessions", len(sm.sessions)).
		Msg("GetOrCreateSession called")

	// Check if session exists
	if session, ok := sm.sessions[sessionID]; ok {
		session.LastActivityAt = time.Now()
		sm.logger.Info().
			Str("session_id", sessionID).
			Str("cluster_manager_ptr", fmt.Sprintf("%p", session.ClusterManager)).
			Int("clusters_in_manager", len(session.ClusterManager.ListClusters())).
			Msg("Returning EXISTING session")
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
		Str("cluster_manager_ptr", fmt.Sprintf("%p", session.ClusterManager)).
		Msg("Created NEW session with isolated cluster manager")

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
	count := len(sm.sessions)
	sm.logger.Debug().
		Int("session_count", count).
		Msg("SessionCount called")
	return count
}

// GetSessionDistribution returns sessions grouped by age
func (sm *SessionManager) GetSessionDistribution() map[string]int {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	distribution := map[string]int{
		"< 5min":   0,
		"5-30min":  0,
		"30-60min": 0,
		"1-24hr":   0,
		"> 24hr":   0,
	}

	now := time.Now()
	for _, session := range sm.sessions {
		age := now.Sub(session.CreatedAt)
		switch {
		case age < 5*time.Minute:
			distribution["< 5min"]++
		case age < 30*time.Minute:
			distribution["5-30min"]++
		case age < 60*time.Minute:
			distribution["30-60min"]++
		case age < 24*time.Hour:
			distribution["1-24hr"]++
		default:
			distribution["> 24hr"]++
		}
	}

	return distribution
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

// CleanupExpiredSessions removes sessions that have exceeded their maximum lifetime
// regardless of activity. This enforces an absolute session expiration time.
func (sm *SessionManager) CleanupExpiredSessions(maxLifetime time.Duration) int {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	now := time.Now()
	removed := 0

	for sessionID, session := range sm.sessions {
		age := now.Sub(session.CreatedAt)
		if age > maxLifetime {
			delete(sm.sessions, sessionID)
			removed++
			sm.logger.Info().
				Str("session_id", sessionID).
				Dur("session_age", age).
				Dur("max_lifetime", maxLifetime).
				Msg("Cleaned up expired session (max lifetime exceeded)")
		}
	}

	return removed
}
