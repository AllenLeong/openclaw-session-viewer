// Shared types between client and server
export type Session = {
  id: string;
  status: 'active' | 'deleted' | 'reset';
  timestamp: string;
  lastModified: string;
  eventCount: number;
  archiveTimestamp?: string;
  cwd?: string;
  agent?: string; // Added agent name
};

export type DisplayEvent = {
  id: string;
  parentId: string | null;
  type: string;
  timestamp: string;
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
  agent?: string; // Added agent name
};

export type SessionData = {
  session: Session;
  events: DisplayEvent[];
};