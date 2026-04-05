import { useState, useMemo, useEffect } from 'react';
import type { DisplayEvent } from '../types';
import { MessageCard } from './MessageCard';

interface TimelineProps {
  events: DisplayEvent[];
  sessionId: string | null;
}

type FilterType = 'all' | 'user' | 'assistant' | 'toolResult';
type ExpandState = 'all' | 'collapsed' | 'expanded';

export function Timeline({ events, sessionId }: TimelineProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandState, setExpandState] = useState<ExpandState>('all');
  const [scrollProgress, setScrollProgress] = useState(0);

  // Build parent-child relationship map (memoized)
  const { childMap, rootEvents, orphanedEvents } = useMemo(() => {
    const childMap: Record<string, DisplayEvent[]> = {};
    const rootEventsList: DisplayEvent[] = [];

    events.forEach(event => {
      if (event.parentId) {
        if (!childMap[event.parentId]) {
          childMap[event.parentId] = [];
        }
        childMap[event.parentId].push(event);
      } else {
        rootEventsList.push(event);
      }
    });

    const orphanedList = events.filter(e =>
      !rootEventsList.some(root => root.id === e.id) &&
      !events.some(other => other.id === e.parentId)
    );

    return { childMap, rootEvents: rootEventsList, orphanedEvents: orphanedList };
  }, [events]);

  // Filter events by type - filter entire tree including children
  const filteredRootEvents = useMemo(() => {
    if (filter === 'all') return rootEvents;

    // Recursive function to check if event or any children match filter
    const matchesFilter = (event: DisplayEvent): boolean => {
      if (event.role === filter || event.type === filter) {
        return true;
      }
      const children = childMap[event.id] || [];
      return children.some(matchesFilter);
    };

    return rootEvents.filter(matchesFilter);
  }, [rootEvents, childMap, filter]);

  // Stats for thumbnail
  const stats = useMemo(() => {
    const userCount = events.filter(e => e.role === 'user').length;
    const assistantCount = events.filter(e => e.role === 'assistant').length;
    const toolCount = events.filter(e => e.role === 'toolResult').length;
    return { userCount, assistantCount, toolCount, total: events.length };
  }, [events]);

  // Scroll progress effect
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!sessionId) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>👈</div>
          <div style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px' }}>Select a session</div>
          <p style={{ fontSize: '14px', color: '#6b7280', maxWidth: '300px' }}>
            Choose a session from the left to view the conversation flow with parent-child relationships
          </p>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
          <div>No events in this session</div>
        </div>
      </div>
    );
  }

  // Recursive function to render event tree
  const renderEventTree = (event: DisplayEvent, depth: number = 0) => {
    const children = childMap[event.id] || [];
    const isExpanded = expandState === 'all' || expandState === 'expanded';

    // Only indent for branching events, limit max depth to 5 levels
    const effectiveDepth = Math.min(depth, 5);

    // Filter children by type if filter is active
    const filteredChildren = filter === 'all'
      ? children
      : children.filter(child => {
          const matchesFilter = (e: DisplayEvent): boolean => {
            if (e.role === filter || e.type === filter) return true;
            const grandchildren = childMap[e.id] || [];
            return grandchildren.some(matchesFilter);
          };
          return matchesFilter(child);
        });

    // Check if current event should be shown
    const selfMatches = filter === 'all' || event.role === filter || event.type === filter;
    const hasMatchingChildren = filteredChildren.length > 0;

    if (!selfMatches && !hasMatchingChildren) {
      return null;
    }

    return (
      <div key={event.id}>
        <MessageCard event={event} depth={effectiveDepth} defaultExpanded={isExpanded} />
        {filteredChildren.map(child => renderEventTree(child, depth + 1))}
      </div>
    );
  };

  return (
    <div style={{ width: '100%', maxWidth: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Session Info Header - Sticky */}
      <div style={{
        position: 'sticky',
        top: '0',
        zIndex: 100,
        background: '#0f172a',
        borderBottom: '1px solid #334155',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      }}>
        <div style={{ padding: '16px 24px 0 24px' }}>
          <h2 style={{ fontSize: '24px', fontFamily: 'monospace', color: '#e2e8f0', margin: '0 0 8px 0', fontWeight: 'bold' }}>
            {sessionId}
          </h2>
          <div style={{ display: 'flex', gap: '16px', fontSize: '14px', color: '#94a3b8', flexWrap: 'wrap' }}>
            <span>{events.length} events</span>
            <span>•</span>
            <span>{rootEvents.length} root</span>
            <span>•</span>
            <span>{orphanedEvents.length} orphaned</span>
          </div>
        </div>

        {/* Control Bar */}
        <div style={{
          display: 'flex',
          gap: '8px',
          paddingTop: '12px',
          paddingBottom: '12px',
          borderTop: '1px solid #1e293b',
          marginTop: '12px',
          flexWrap: 'wrap',
          padding: '12px 24px',
        }}>
          {/* Expand/Collapse Controls */}
          <button
            onClick={() => {
              setExpandState('expanded');
            }}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: expandState === 'expanded' ? '#4f46e5' : '#1e293b',
              color: expandState === 'expanded' ? '#fff' : '#94a3b8',
              border: '1px solid #4f46e5',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            全部展开
          </button>
          <button
            onClick={() => {
              setExpandState('collapsed');
            }}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: expandState === 'collapsed' ? '#4f46e5' : '#1e293b',
              color: expandState === 'collapsed' ? '#fff' : '#94a3b8',
              border: '1px solid #4f46e5',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            全部收起
          </button>

          <div style={{ width: '1px', background: '#334155', margin: '0 4px' }} />

          {/* Filter Controls */}
          <button
            onClick={() => setFilter('all')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: filter === 'all' ? '#4f46e5' : '#1e293b',
              color: filter === 'all' ? '#fff' : '#94a3b8',
              border: '1px solid #4f46e5',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            全部 ({stats.total})
          </button>
          <button
            onClick={() => setFilter('user')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: filter === 'user' ? '#3b82f6' : '#1e293b',
              color: filter === 'user' ? '#fff' : '#94a3b8',
              border: '1px solid #3b82f6',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            👤 用户 ({stats.userCount})
          </button>
          <button
            onClick={() => setFilter('assistant')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: filter === 'assistant' ? '#22c55e' : '#1e293b',
              color: filter === 'assistant' ? '#fff' : '#94a3b8',
              border: '1px solid #22c55e',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            🤖 助手 ({stats.assistantCount})
          </button>
          <button
            onClick={() => setFilter('toolResult')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: filter === 'toolResult' ? '#6b7280' : '#1e293b',
              color: filter === 'toolResult' ? '#fff' : '#94a3b8',
              border: '1px solid #6b7280',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            🔧 工具 ({stats.toolCount})
          </button>
        </div>

        {/* Thumbnail Navigation - Sticky */}
        <div style={{
          position: 'sticky',
          top: '110px',
          marginTop: '12px',
          padding: '8px 24px',
          background: '#1e293b',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          overflowX: 'auto',
          maxWidth: '100%',
          zIndex: 50,
          borderBottom: '1px solid #334155',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        }}>
          {events.slice(0, 200).map((event, index) => (
            <div
              key={event.id}
              title={`${event.role || event.type} - ${event.id.slice(0, 4)} - Click to scroll`}
              onClick={() => {
                const element = document.getElementById(`event-${event.id}`);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              style={{
                width: '4px',
                height: index % 5 === 0 ? '32px' : '20px',
                minWidth: '4px',
                background: event.role === 'user' ? '#3b82f6' : event.role === 'assistant' ? '#22c55e' : '#6b7280',
                opacity: filter !== 'all' && (event.role !== filter && event.type !== filter) ? 0.2 : 0.8,
                borderRadius: '2px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scaleY(1.5)';
                e.currentTarget.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scaleY(1)';
                e.currentTarget.style.opacity = String(filter !== 'all' && (event.role !== filter && event.type !== filter) ? 0.2 : 0.8);
              }}
            />
          ))}
          {events.length > 200 && (
            <div style={{ fontSize: '10px', color: '#64748b', marginLeft: '8px', whiteSpace: 'nowrap' }}>
              +{events.length - 200} more
            </div>
          )}
        </div>
      </div>

      {/* Events Container */}
      <div style={{ position: 'relative', paddingBottom: '40px', marginTop: '160px' }}>
        {/* Root events */}
        {filteredRootEvents.map(event => renderEventTree(event, 0))}

        {/* Orphaned events */}
        {orphanedEvents.length > 0 && (
          <div style={{ marginTop: '30px', paddingTop: '15px', borderTop: '1px dashed #4b5563' }}>
            <h4 style={{ fontSize: '16px', color: '#94a3b8', marginBottom: '12px', display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '8px' }}>⚠️</span> Orphaned Events ({orphanedEvents.length})
            </h4>
            {orphanedEvents.map(event => (
              <div key={`orphan-${event.id}`} style={{ marginLeft: '20px' }}>
                <MessageCard event={event} depth={0} defaultExpanded={expandState !== 'collapsed'} />
              </div>
            ))}
          </div>
        )}

        {/* Back to top button and progress bar */}
        {scrollProgress > 10 && (
          <div style={{ marginTop: '40px', textAlign: 'center' }}>
            <button
              onClick={scrollToTop}
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                background: '#4f46e5',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
              }}
            >
              ↑ 返回顶部
            </button>
          </div>
        )}
      </div>

      {/* Scroll progress bar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: `${scrollProgress}%`,
        height: '3px',
        background: 'linear-gradient(90deg, #4f46e5, #22c55e)',
        transition: 'width 0.1s',
        zIndex: 1000,
        pointerEvents: 'none',
      }} />
    </div>
  );
}
