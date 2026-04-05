import { useState, useEffect, useCallback } from 'react';
import type { Session, DisplayEvent } from '../types';

interface UseSessionsState {
  sessions: Session[];
  selectedSession: Session | null;
  events: DisplayEvent[];
  loading: boolean;
  error: string | null;
}

const API_BASE = 'http://localhost:3001/api';

export function useSessions() {
  const [state, setState] = useState<UseSessionsState>({
    sessions: [],
    selectedSession: null,
    events: [],
    loading: true,
    error: null,
  });

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Load all sessions
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/sessions`);
      const data = await res.json();
      setState((prev) => ({ ...prev, sessions: data.sessions, loading: false }));
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, error: 'Failed to load sessions' }));
      console.error('Error loading sessions:', error);
    }
  }, []);

  // Load single session details
  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`${API_BASE}/session/${sessionId}`);
      const data = await res.json();
      setState((prev) => ({
        ...prev,
        selectedSession: data.session,
        events: data.events,
      }));
      setSelectedSessionId(sessionId);
    } catch (error) {
      console.error('Error loading session:', error);
    }
  }, []);

  // Update session with new events (from WebSocket)
  const updateSession = useCallback((sessionId: string, newEvents: DisplayEvent[]) => {
    setState((prev) => {
      // Update events if this is the selected session
      if (prev.selectedSession?.id === sessionId) {
        return {
          ...prev,
          events: [...prev.events, ...newEvents],
        };
      }
      // Update sessions list
      const updatedSessions = prev.sessions.map((s) =>
        s.id === sessionId
          ? { ...s, eventCount: s.eventCount + newEvents.length, lastModified: new Date().toISOString() }
          : s
      );
      return { ...prev, sessions: updatedSessions };
    });
  }, []);

  // Add new session to list
  const addSession = useCallback((session: Session) => {
    setState((prev) => ({
      ...prev,
      sessions: [session, ...prev.sessions],
    }));
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const selectSession = useCallback(
    (sessionId: string) => {
      loadSession(sessionId);
    },
    [loadSession]
  );

  return {
    sessions: state.sessions,
    selectedSessionId,
    selectedSession: state.selectedSession,
    events: state.events,
    loading: state.loading,
    error: state.error,
    selectSession,
    updateSession,
    addSession,
    refreshSessions: loadSessions,
  };
}
