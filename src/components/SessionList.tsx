import { useState, useMemo } from 'react';
import type { Session } from '../types';

interface SessionListProps {
  sessions: Session[];
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}

interface FilterState {
  status: 'all' | 'active' | 'deleted' | 'reset';
  agent: string | 'all';
  search: string;
}

export function SessionList({ sessions, selectedSessionId, onSelectSession }: SessionListProps) {
  const [filter, setFilter] = useState<FilterState>({
    status: 'all',
    agent: 'all',
    search: '',
  });

  // Track expanded state for each agent
  const [expandedAgents, setExpandedAgents] = useState<Record<string, boolean>>({});

  const toggleAgent = (agent: string) => {
    setExpandedAgents(prev => ({ ...prev, [agent]: !prev[agent] }));
  };

  const getStatusStyle = (status: Session['status']) => {
    switch (status) {
      case 'active':
        return { bg: '#22c55e', text: 'Active' };
      case 'deleted':
        return { bg: '#ef4444', text: 'Deleted' };
      case 'reset':
        return { bg: '#f59e0b', text: 'Reset' };
      default:
        return { bg: '#6b7280', text: 'Unknown' };
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get unique agents from sessions
  const agents = useMemo(() => {
    const agentSet = new Set(sessions.map(s => s.agent).filter(Boolean));
    return Array.from(agentSet) as string[];
  }, [sessions]);

  // Filter sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      // Filter by status
      if (filter.status !== 'all' && session.status !== filter.status) {
        return false;
      }
      // Filter by agent
      if (filter.agent !== 'all' && session.agent !== filter.agent) {
        return false;
      }
      // Filter by search
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        const idMatch = session.id.toLowerCase().includes(searchLower);
        const cwdMatch = session.cwd?.toLowerCase().includes(searchLower);
        return idMatch || cwdMatch;
      }
      return true;
    });
  }, [sessions, filter]);

  // Group sessions by agent
  const sessionsByAgent = useMemo(() => {
    const grouped: Record<string, Session[]> = {};
    for (const session of filteredSessions) {
      const agent = session.agent || 'unknown';
      if (!grouped[agent]) {
        grouped[agent] = [];
      }
      grouped[agent].push(session);
    }
    return grouped;
  }, [filteredSessions]);

  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatTime(timestamp);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1e293b' }}>
      {/* Filter Header */}
      <div style={{
        padding: '12px',
        borderBottom: '1px solid #334155',
        background: '#1e293b',
        flexShrink: 0,
      }}>
        {/* Search */}
        <input
          type="text"
          placeholder="Search sessions..."
          value={filter.search}
          onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
          style={{
            width: '100%',
            padding: '8px 12px',
            marginBottom: '8px',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '6px',
            color: '#e2e8f0',
            fontSize: '13px',
            outline: 'none',
          }}
        />

        {/* Status Filter */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
          {(['all', 'active', 'deleted', 'reset'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilter(prev => ({ ...prev, status }))}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: filter.status === status ? '600' : '400',
                background: filter.status === status ? getStatusStyle(status === 'all' ? 'active' : status).bg : 'transparent',
                color: filter.status === status ? '#000' : '#94a3b8',
                border: `1px solid ${getStatusStyle(status === 'all' ? 'active' : status).bg}`,
                borderRadius: '12px',
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Agent Filter */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilter(prev => ({ ...prev, agent: 'all' }))}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              background: filter.agent === 'all' ? '#4f46e5' : 'transparent',
              color: filter.agent === 'all' ? '#fff' : '#94a3b8',
              border: '1px solid #4f46e5',
              borderRadius: '12px',
              cursor: 'pointer',
            }}
          >
            All
          </button>
          {agents.map(agent => (
            <button
              key={agent}
              onClick={() => setFilter(prev => ({ ...prev, agent: agent! }))}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                background: filter.agent === agent ? '#4f46e5' : 'transparent',
                color: filter.agent === agent ? '#fff' : '#94a3b8',
                border: '1px solid #4f46e5',
                borderRadius: '12px',
                cursor: 'pointer',
              }}
            >
              {agent}
            </button>
          ))}
        </div>

        {/* Session count */}
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{filteredSessions.length} / {sessions.length} sessions</span>
          <button
            onClick={() => {
              const allExpanded = agents.every(agent => expandedAgents[agent]);
              const newExpanded: Record<string, boolean> = {};
              agents.forEach(agent => {
                newExpanded[agent] = !allExpanded;
              });
              setExpandedAgents(newExpanded);
            }}
            style={{
              padding: '2px 8px',
              fontSize: '11px',
              background: '#1e293b',
              color: '#94a3b8',
              border: '1px solid #334155',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {agents.every(agent => expandedAgents[agent]) ? '全部收起' : '全部展开'}
          </button>
        </div>
      </div>

      {/* Session List */}
      {Object.entries(sessionsByAgent).map(([agent, agentSessions]) => {
        const isExpanded = expandedAgents[agent] ?? false;
        return (
          <div key={agent}>
            {/* Agent Header */}
            <div style={{
              padding: '8px 16px',
              background: '#0f172a',
              borderBottom: '1px solid #334155',
              borderTop: '1px solid #334155',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
            onClick={() => toggleAgent(agent)}
            >
              {/* Expand/Collapse Arrow */}
              <span style={{ fontSize: '10px', color: '#64748b', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                ▶
              </span>
              {/* Avatar */}
              <img
                src={`http://localhost:3001/api/agent/${agent}/avatar`}
                alt={agent}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  objectFit: 'cover',
                  background: '#334155',
                }}
              />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0' }}>{agent}</span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>({agentSessions.length})</span>
            </div>

            {/* Sessions for this agent */}
            {isExpanded && agentSessions
              .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
              .map((session) => (
              <div
                key={`${session.id}-${session.status}`}
                onClick={() => onSelectSession(session.id)}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  background: selectedSessionId === session.id ? '#334155' : 'transparent',
                  borderLeft: selectedSessionId === session.id ? '3px solid #818cf8' : '3px solid transparent',
                  transition: 'all 0.2s ease',
                  borderBottom: '1px solid #1e293b',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = selectedSessionId === session.id ? '#334155' : '#313244')}
                onMouseLeave={(e) => (e.currentTarget.style.background = selectedSessionId === session.id ? '#334155' : 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: getStatusStyle(session.status).bg,
                      flexShrink: 0,
                    }}
                    title={session.status}
                  />
                  <span style={{ fontSize: '13px', fontFamily: 'monospace', color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {session.id.slice(0, 8)}...{session.id.slice(-4)}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{formatRelativeTime(session.lastModified)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>{session.eventCount} events</span>
                  <span style={{ fontSize: '11px', background: getStatusStyle(session.status).bg, color: '#000', padding: '1px 6px', borderRadius: '3px', textTransform: 'uppercase', fontWeight: '600' }}>
                    {getStatusStyle(session.status).text}
                  </span>
                </div>
                {session.cwd && (
                  <div style={{ marginTop: '4px', fontSize: '11px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    📁 {session.cwd.split('/').pop()}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
