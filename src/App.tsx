import { SessionList } from './components/SessionList';
import { Timeline } from './components/Timeline';
import { useSessions } from './hooks/useSessions';
import { useWebSocket } from './hooks/useWebSocket';
import { useState, useRef, useCallback } from 'react';
import './App.css';

function App() {
  const {
    sessions,
    selectedSessionId,
    selectSession,
    updateSession,
    addSession,
    events,
    loading,
    error,
  } = useSessions();

  const [sidebarWidth, setSidebarWidth] = useState(320);
  const isResizing = useRef(false);

  const startResizing = useCallback(() => {
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing.current) {
      const newWidth = Math.min(Math.max(e.clientX, 250), 600);
      setSidebarWidth(newWidth);
    }
  }, []);

  // Add/remove global mouse events for resizing
  useState(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  });

  console.log('[App] sessions:', sessions.length, 'loading:', loading, 'error:', error);

  // Connect to WebSocket for real-time updates
  useWebSocket('ws://localhost:3001/ws', {
    onMessage: (message) => {
      console.log('[WebSocket] Message:', message);
      switch (message.type) {
        case 'session-updated':
          updateSession(message.data.sessionId, message.data.events);
          break;
        case 'session-new':
          addSession(message.data.session);
          break;
      }
    },
    onConnect: () => {
      console.log('[WebSocket] Connected to server');
    },
    onDisconnect: () => {
      console.log('[WebSocket] Disconnected from server');
    },
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#f1f5f9' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '16px', animation: 'pulse 1.5s infinite' }}>⏳</div>
          <div style={{ fontSize: '18px', fontWeight: '500' }}>Loading sessions...</div>
          <div style={{ fontSize: '14px', color: '#94a3b8', marginTop: '8px' }}>Monitoring OpenClaw agents</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#f1f5f9' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '36px', marginBottom: '16px' }}>❌</div>
          <div style={{ fontSize: '18px', fontWeight: '500', color: '#f87171', marginBottom: '8px' }}>Error Loading Data</div>
          <div style={{ color: '#f87171' }}>Error: {error}</div>
          <div style={{ marginTop: '16px', fontSize: '14px', color: '#94a3b8' }}>
            Please check that OpenClaw is running and the session directory exists
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f172a', color: '#f1f5f9', overflow: 'hidden' }}>
      {/* Header - Sticky */}
      <header style={{
        padding: '16px 24px',
        borderBottom: '1px solid #334155',
        background: '#1e293b',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#e2e8f0' }}>OpenClaw Dashboard</h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '15px', color: '#94a3b8' }}>
              {sessions.length} sessions from {new Set(sessions.map(s => s.agent)).size} agents
            </p>
          </div>
          <div style={{ fontSize: '14px', color: '#64748b' }}>
            Real-time Monitoring
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar - Session list */}
        <div style={{ width: sidebarWidth, flexShrink: 0, borderRight: '1px solid #334155', background: '#1e293b', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          <SessionList
            sessions={sessions}
            selectedSessionId={selectedSessionId}
            onSelectSession={selectSession}
          />
        </div>

        {/* Resizer handle */}
        <div
          onMouseDown={startResizing}
          style={{
            width: '8px',
            flexShrink: 0,
            cursor: 'col-resize',
            background: isResizing ? '#818cf8' : 'transparent',
            transition: 'background 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#4f46e5')}
          onMouseLeave={(e) => (e.currentTarget.style.background = isResizing ? '#818cf8' : 'transparent')}
        >
          <div style={{ width: '2px', height: '24px', background: '#475569', borderRadius: '1px' }} />
        </div>

        {/* Main content - Timeline */}
        <div style={{ flex: 1, background: '#0f172a', position: 'relative', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <Timeline
            events={events}
            sessionId={selectedSessionId}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
