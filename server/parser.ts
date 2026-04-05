import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

export interface Session {
  id: string;
  status: 'active' | 'deleted' | 'reset';
  timestamp: string;
  lastModified: string;
  eventCount: number;
  archiveTimestamp?: string;
  cwd?: string;
  agent?: string; // Added agent name
}

export interface RawEvent {
  type: string;
  id: string;
  parentId: string | null;
  timestamp: string;
  message?: any;
  customType?: string;
  data?: any;
  thinkingLevel?: string;
  provider?: string;
  modelId?: string;
}

export interface DisplayEvent {
  id: string;
  parentId: string | null;
  type: string;
  timestamp: Date;
  role?: 'user' | 'assistant' | 'toolResult';
  isSubagent?: boolean;
  content?: any[];
  toolName?: string;
  toolArgs?: any;
  toolResult?: any;
  isError?: boolean;
  hasMedia?: boolean;
  mediaPath?: string;
  text?: string;
}

/**
 * Parse a single JSONL line into a RawEvent
 */
export function parseRawEvent(line: string): RawEvent | null {
  try {
    return JSON.parse(line.trim());
  } catch (e) {
    console.error('Failed to parse JSONL line:', e);
    return null;
  }
}

/**
 * Extract display-friendly event from raw event
 */
export function extractDisplayEvent(raw: RawEvent): DisplayEvent {
  const event: DisplayEvent = {
    id: raw.id,
    parentId: raw.parentId,
    type: raw.type,
    timestamp: new Date(raw.timestamp),
  };

  if (raw.type === 'message' && raw.message) {
    const msg = raw.message;
    event.role = msg.role;
    event.content = msg.content;

    // Check for subagent
    if (msg.role === 'user' && msg.content) {
      const textContent = msg.content.find((c: any) => c.type === 'text');
      if (textContent?.text?.includes('[Subagent Context]')) {
        event.isSubagent = true;
      }
    }

    // Extract tool call info
    if (msg.role === 'assistant' && msg.content) {
      const toolCall = msg.content.find((c: any) => c.type === 'toolCall');
      if (toolCall) {
        event.toolName = toolCall.name;
        event.toolArgs = toolCall.arguments;
      }
      // Check for media
      if (msg.content.some((c: any) => c.media)) {
        event.hasMedia = true;
        const mediaItem = msg.content.find((c: any) => c.media);
        event.mediaPath = mediaItem?.media;
      }
    }

    // Extract tool result info
    if (msg.role === 'toolResult') {
      event.toolName = raw.message.toolName;
      event.toolResult = msg.content;
      event.isError = msg.isError;
    }

    // Extract text content for display
    if (msg.content) {
      const textItem = msg.content.find((c: any) => c.type === 'text');
      if (textItem) {
        event.text = textItem.text;
      }
    }
  }

  return event;
}

/**
 * Parse a session file and return Session metadata + events
 */
export async function parseSessionFile(filePath: string): Promise<{ session: Session; events: DisplayEvent[] }> {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);

  let sessionData: any = null;
  const events: DisplayEvent[] = [];

  for (const line of lines) {
    const raw = parseRawEvent(line);
    if (!raw) continue;

    if (raw.type === 'session') {
      sessionData = raw;
    }

    if (raw) {
      events.push(extractDisplayEvent(raw));
    }
  }

  // Determine status from filename
  const filename = filePath.split('/').pop() || '';
  let status: Session['status'] = 'active';
  let archiveTimestamp: string | undefined;

  if (filename.includes('.deleted.')) {
    status = 'deleted';
    const match = filename.match(/\.deleted\.(.+)$/);
    if (match) archiveTimestamp = match[1];
  } else if (filename.includes('.reset.')) {
    status = 'reset';
    const match = filename.match(/\.reset\.(.+)$/);
    if (match) archiveTimestamp = match[1];
  }

  const session: Session = {
    id: sessionData?.id || filename.replace(/\.jsonl.*$/, ''),
    status,
    timestamp: sessionData?.timestamp || new Date().toISOString(),
    lastModified: events.length > 0 ? events[events.length - 1].timestamp.toISOString() : new Date().toISOString(),
    eventCount: events.length,
    archiveTimestamp,
    cwd: sessionData?.cwd,
  };

  return { session, events };
}

/**
 * List all session files in the directory
 */
export async function listSessionFiles(sessionDir: string): Promise<string[]> {
  const { readdir } = await import('fs/promises');
  const files = await readdir(sessionDir);
  return files
    .filter(f => f.endsWith('.jsonl') || f.includes('.jsonl.deleted.') || f.includes('.jsonl.reset.'))
    .map(f => `${sessionDir}/${f}`);
}
