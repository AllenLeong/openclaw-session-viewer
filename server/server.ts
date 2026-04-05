import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { join } from 'path';
import { FileWatcher } from './fileWatcher.js';
import { parseSessionFile, listSessionFiles, DisplayEvent, Session } from './parser.js';
import { readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';

const SESSIONS_ROOT_DIR = '/Users/a/.openclaw/agents';
const OPENCLAW_CONFIG_PATH = '/Users/a/.openclaw/openclaw.json';
const PORT = 3001;

const app = express();
app.use(cors({
  origin: '*', // Allow all origins for dev
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

// Store connected clients
const clients = new Set<WebSocket>();

// File watcher instance
const watcher = new FileWatcher(SESSIONS_ROOT_DIR);

// Cache for session data
const sessionCache = new Map<string, { session: Session; events: DisplayEvent[] }>();

// Setup WebSocket connections
wss.on('connection', (ws) => {
  console.log('[WebSocket] Client connected');
  clients.add(ws);

  ws.on('close', () => {
    console.log('[WebSocket] Client disconnected');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('[WebSocket] Error:', error);
    clients.delete(ws);
  });
});

// Broadcast to all connected clients
function broadcast(type: string, data: any) {
  const message = JSON.stringify({ type, data });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Setup file watcher events
watcher.on('file-changed', async (filePath: string) => {
  try {
    const filename = filePath.split('/').pop() || '';
    const sessionId = filename.replace(/\.jsonl.*$/, '');
    const { session, events } = await parseSessionFile(filePath);
    sessionCache.set(sessionId, { session, events });

    // Get new events since last cached
    const cached = sessionCache.get(sessionId);
    if (cached) {
      broadcast('session-updated', {
        sessionId,
        session,
        events: events.slice(-10), // Send last 10 events
      });
    }
  } catch (error) {
    console.error(`Error processing file change: ${filePath}`, error);
  }
});

watcher.on('file-added', async (filePath: string) => {
  try {
    const filename = filePath.split('/').pop() || '';
    const sessionId = filename.replace(/\.jsonl.*$/, '');
    const { session, events } = await parseSessionFile(filePath);
    sessionCache.set(sessionId, { session, events });

    broadcast('session-new', {
      sessionId,
      session,
      eventCount: events.length,
    });
  } catch (error) {
    console.error(`Error processing new file: ${filePath}`, error);
  }
});

// REST API endpoints

// Get all sessions from all agents
app.get('/api/sessions', async (req, res) => {
  try {
    const agentConfigs = await getAgentConfigs();

    // Scan all agent directories
    const agentDirs = await readdir(SESSIONS_ROOT_DIR);
    const allSessionFiles: string[] = [];

    for (const agentDir of agentDirs) {
      const agentPath = join(SESSIONS_ROOT_DIR, agentDir, 'sessions');
      try {
        if (await isValidPath(agentPath)) {
          const files = await listSessionFiles(agentPath);
          files.forEach(file => allSessionFiles.push(file));
        }
      } catch (err) {
        console.log(`[Server] No sessions directory for agent: ${agentDir}`);
      }
    }

    const sessions = [];
    for (const file of allSessionFiles) {
      try {
        const { session } = await parseSessionFile(file);
        const agentId = file.split('/')[5]; // Extract agent name from path
        session.agent = agentId;

        // Add workspace and identity from config
        const agentConfig = agentConfigs[agentId];
        if (agentConfig) {
          session.workspace = agentConfig.workspace;
          session.identity = agentConfig.identity;
        }

        sessions.push(session);
      } catch (error) {
        console.error(`Error parsing ${file}:`, error);
      }
    }

    // Sort by lastModified, newest first
    sessions.sort((a, b) =>
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );

    res.json({ sessions });
  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// Helper to check if path exists
async function isValidPath(path: string): Promise<boolean> {
  try {
    const { stat } = await import('fs/promises');
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

// Get agent config from openclaw.json
async function getAgentConfigs() {
  try {
    if (!existsSync(OPENCLAW_CONFIG_PATH)) {
      return {};
    }
    const content = await readFile(OPENCLAW_CONFIG_PATH, 'utf-8');
    const config = JSON.parse(content);

    const agentConfigs: Record<string, { workspace?: string; identity?: { avatar?: string } }> = {};

    // Try config.agents.list first, fallback to config.list
    const agentList = Array.isArray(config.agents?.list) ? config.agents.list : (Array.isArray(config.list) ? config.list : []);

    for (const agent of agentList) {
      if (agent.id) {
        agentConfigs[agent.id] = {
          workspace: agent.workspace,
          identity: agent.identity,
        };
      }
    }

    return agentConfigs;
  } catch (error) {
    console.error('Error loading agent configs:', error);
    return {};
  }
}

// Get agent avatar path
async function getAgentAvatar(agentId: string) {
  try {
    const configs = await getAgentConfigs();
    const config = configs[agentId];

    if (config?.workspace && config?.identity?.avatar) {
      // Avatar path is relative to workspace
      const avatarPath = join(config.workspace, config.identity.avatar);
      if (existsSync(avatarPath)) {
        return avatarPath;
      }
    }

    // Fallback to default portrait.png in agent directory
    const defaultAvatar = join(SESSIONS_ROOT_DIR, agentId, 'portrait.png');
    if (existsSync(defaultAvatar)) {
      return defaultAvatar;
    }

    return null;
  } catch {
    return null;
  }
}

// Get single session details
app.get('/api/session/:id', async (req, res) => {
  try {
    const sessionId = req.params.id;

    // Check cache first
    const cached = sessionCache.get(sessionId);
    if (cached) {
      res.json({ session: cached.session, events: cached.events });
      return;
    }

    // Scan all agent directories to find the session
    const agentDirs = await readdir(SESSIONS_ROOT_DIR);
    let sessionFile: string | null = null;

    for (const agentDir of agentDirs) {
      const agentPath = join(SESSIONS_ROOT_DIR, agentDir, 'sessions');
      try {
        if (await isValidPath(agentPath)) {
          const files = await listSessionFiles(agentPath);
          const foundFile = files.find(f => {
            const filename = f.split('/').pop() || '';
            return filename.replace(/\.jsonl.*$/, '') === sessionId;
          });

          if (foundFile) {
            sessionFile = foundFile;
            break;
          }
        }
      } catch (err) {
        console.log(`[Server] No sessions directory for agent: ${agentDir}`);
      }
    }

    if (!sessionFile) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const { session, events } = await parseSessionFile(sessionFile);
    session.agent = sessionFile.split('/')[5]; // Extract agent name from path
    sessionCache.set(sessionId, { session, events });

    res.json({ session, events });
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// Get agent avatar image
app.get('/api/agent/:id/avatar', async (req, res) => {
  try {
    const avatarPath = await getAgentAvatar(req.params.id);
    if (!avatarPath || !existsSync(avatarPath)) {
      res.status(404).json({ error: 'Avatar not found' });
      return;
    }

    const { createReadStream } = await import('fs');
    const stream = createReadStream(avatarPath);
    res.setHeader('Content-Type', 'image/png');
    stream.pipe(res);
  } catch (error) {
    console.error('Error serving avatar:', error);
    res.status(500).json({ error: 'Failed to serve avatar' });
  }
});

// Get agent configs
app.get('/api/agents', async (req, res) => {
  try {
    const configs = await getAgentConfigs();
    res.json({ agents: configs });
  } catch (error) {
    console.error('Error getting agent configs:', error);
    res.status(500).json({ error: 'Failed to get agent configs' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', clients: clients.size });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`[Server] Listening on http://localhost:${PORT}`);
  console.log(`[Server] WebSocket endpoint: ws://localhost:${PORT}/ws`);

  // Start file watcher
  watcher.start();

  // Pre-load existing sessions
  (async () => {
    try {
      const agentDirs = await readdir(SESSIONS_ROOT_DIR);
      let totalSessions = 0;

      for (const agentDir of agentDirs) {
        const agentPath = join(SESSIONS_ROOT_DIR, agentDir, 'sessions');
        try {
          if (await isValidPath(agentPath)) {
            const files = await listSessionFiles(agentPath);
            console.log(`[Server] Pre-loading ${files.length} session files from agent: ${agentDir}`);

            for (const file of files.slice(0, 10)) { // Limit to 10 for initial load per agent
              try {
                const { session, events } = await parseSessionFile(file);
                const sessionId = session.id;
                session.agent = file.split('/')[5]; // Extract agent name from path
                sessionCache.set(sessionId, { session, events });
                totalSessions++;
              } catch (error) {
                console.error(`Error pre-loading ${file}:`, error);
              }
            }
          }
        } catch (err) {
          console.log(`[Server] No sessions directory for agent: ${agentDir}`);
        }
      }
      console.log(`[Server] Pre-loaded ${totalSessions} sessions from all agents`);
    } catch (error) {
      console.error('Error pre-loading sessions:', error);
    }
  })();
});
