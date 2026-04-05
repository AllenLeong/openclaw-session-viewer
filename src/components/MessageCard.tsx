import { useState, useEffect } from 'react';
import type { DisplayEvent } from '../types';
import ReactMarkdown from 'react-markdown';

interface MessageCardProps {
  event: DisplayEvent;
  depth?: number;
  defaultExpanded?: boolean;
}

export function MessageCard({ event, depth = 0, defaultExpanded = true }: MessageCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(!defaultExpanded);

  // Reset collapsed state when defaultExpanded changes
  useEffect(() => {
    setIsCollapsed(!defaultExpanded);
  }, [defaultExpanded]);

  const getRoleStyle = () => {
    if (event.role === 'user') {
      return { border: '1px solid #3b82f6', bg: 'rgba(59, 130, 246, 0.05)' };
    }
    if (event.role === 'assistant') {
      return { border: '1px solid #22c55e', bg: 'rgba(34, 197, 94, 0.05)' };
    }
    if (event.role === 'toolResult') {
      return { border: event.isError ? '1px solid #ef4444' : '1px solid #4b5563', bg: event.isError ? 'rgba(239, 68, 68, 0.05)' : 'rgba(75, 85, 99, 0.3)' };
    }
    return { border: '1px solid #4b5563', bg: 'rgba(75, 85, 99, 0.2)' };
  };

  const getRoleBadge = () => {
    if (event.role === 'user') {
      return { text: event.isSubagent ? 'Subagent' : 'User', color: event.isSubagent ? '#f97316' : '#3b82f6' };
    }
    if (event.role === 'assistant') {
      return { text: 'Assistant', color: '#22c55e' };
    }
    if (event.role === 'toolResult') {
      return { text: event.isError ? 'Error' : (event.toolName || 'Tool'), color: event.isError ? '#ef4444' : '#6b7280' };
    }
    return { text: event.type, color: '#4b5563' };
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getPreviewText = () => {
    if (event.toolName && event.role === 'assistant') {
      return `🔧 ${event.toolName}`;
    }
    if (event.role === 'toolResult') {
      const textContent = Array.isArray(event.toolResult)
        ? event.toolResult.find((item: any) => item.type === 'text')?.text
        : event.toolResult;
      return typeof textContent === 'string' ? textContent.slice(0, 100) : 'Result';
    }
    if (event.text) {
      return event.text.replace(/\n/g, ' ').slice(0, 100);
    }
    return event.type;
  };

  const renderContent = () => {
    // Tool call display
    if (event.toolName && event.role === 'assistant') {
      return (
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🔧</span> {event.toolName}
          </div>
          {event.toolArgs && (
            <pre style={{ padding: '12px', background: '#0f172a', borderRadius: '6px', fontSize: '12px', color: '#a5b4fc', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {JSON.stringify(event.toolArgs, null, 2)}
            </pre>
          )}
        </div>
      );
    }

    // Tool result display
    if (event.role === 'toolResult' && event.toolResult) {
      const textContent = Array.isArray(event.toolResult)
        ? event.toolResult.find((item: any) => item.type === 'text')?.text
        : event.toolResult;

      return (
        <div style={{ marginTop: '12px' }}>
          {event.toolName && (
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {event.toolName} Result
            </div>
          )}
          <pre style={{ padding: '12px', background: '#0f172a', borderRadius: '6px', fontSize: '12px', color: event.isError ? '#fca5a5' : '#d1d5db', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.5' }}>
            {typeof textContent === 'string' ? textContent : JSON.stringify(event.toolResult, null, 2)}
          </pre>
        </div>
      );
    }

    // Text content display
    if (event.text) {
      return (
        <div style={{ marginTop: '12px', fontSize: '14px', lineHeight: 1.7, color: '#e2e8f0' }}>
          <ReactMarkdown>{event.text}</ReactMarkdown>
        </div>
      );
    }

    return null;
  };

  const roleStyle = getRoleStyle();
  const badge = getRoleBadge();

  return (
    <div id={`event-${event.id}`} style={{
      marginBottom: '16px',
      marginLeft: `${depth * 30}px`,
    }}>
      <div style={{
        border: roleStyle.border,
        borderRadius: '8px',
        background: roleStyle.bg,
        padding: '0',
        width: '100%',
      }}>
        {/* Header - Sticky within card */}
        <div style={{
          padding: '10px 16px',
          background: roleStyle.bg,
          borderBottom: isCollapsed ? 'none' : `1px solid ${roleStyle.border.replace('1px solid', 'rgba')}`,
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          cursor: 'pointer',
          zIndex: 10,
        }}
        onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <span style={{
            fontSize: '11px',
            fontWeight: '600',
            background: badge.color,
            color: '#fff',
            padding: '3px 8px',
            borderRadius: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            flexShrink: 0,
          }}>
            {badge.text}
          </span>
          <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace', flexShrink: 0 }}>
            {formatTime(event.timestamp)}
          </span>
          {event.parentId && (
            <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }} title={`Parent: ${event.parentId}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
              {event.parentId.slice(0, 4)}
            </span>
          )}
          <span style={{ fontSize: '11px', color: '#475569', fontFamily: 'monospace', marginLeft: 'auto', flexShrink: 0 }}>
            #{event.id.slice(0, 4)}
          </span>
          <span style={{ fontSize: '16px', color: '#64748b', marginLeft: '8px' }}>
            {isCollapsed ? '▶' : '▼'}
          </span>
        </div>

        {/* Collapsed preview */}
        {isCollapsed && (
          <div style={{
            padding: '12px 16px',
            fontSize: '13px',
            color: '#94a3b8',
            borderTop: `1px solid ${roleStyle.border.replace('1px solid', 'rgba')}`,
          }}>
            <span style={{ color: '#64748b' }}>📄 </span>
            {getPreviewText()}...
            <span style={{ color: '#4f46e5', marginLeft: '8px', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setIsCollapsed(false); }}>
              展开
            </span>
          </div>
        )}

        {/* Content */}
        {!isCollapsed && (
          <div style={{ padding: '16px', overflowX: 'auto', maxWidth: '100%' }}>
            {renderContent()}
          </div>
        )}

        {event.hasMedia && event.mediaPath && !isCollapsed && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #334155', background: '#1e293b', overflowX: 'auto' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px', wordBreak: 'break-all' }}>📎 {event.mediaPath}</div>
          </div>
        )}
      </div>
    </div>
  );
}
