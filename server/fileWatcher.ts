import chokidar from 'chokidar';
import { EventEmitter } from 'events';
import { readdir } from 'fs/promises';

export class FileWatcher extends EventEmitter {
  private watcher: chokidar.FSWatcher | null = null;
  private sessionRootDir: string;

  constructor(sessionRootDir: string) {
    super();
    this.sessionRootDir = sessionRootDir;
  }

  async start() {
    if (this.watcher) {
      return;
    }

    // Discover all agent directories and their sessions
    let patterns: string[] = [];
    try {
      const agentDirs = await readdir(this.sessionRootDir);
      for (const agentDir of agentDirs) {
        const agentPath = `${this.sessionRootDir}/${agentDir}`;
        try {
          const { stat } = await import('fs/promises');
          const stats = await stat(agentPath);
          if (stats.isDirectory()) {
            const sessionsPath = `${agentPath}/sessions`;
            // Check if sessions directory exists
            try {
              await stat(sessionsPath);
              patterns.push(`${sessionsPath}/*.jsonl`);
              patterns.push(`${sessionsPath}/*.jsonl.deleted.*`);
              patterns.push(`${sessionsPath}/*.jsonl.reset.*`);
            } catch {
              console.log(`[FileWatcher] No sessions directory for agent: ${agentDir}`);
            }
          }
        } catch (err) {
          console.log(`[FileWatcher] Could not access agent directory: ${agentDir}`);
        }
      }
    } catch (err) {
      console.error(`[FileWatcher] Error scanning agent directories:`, err);
      // Fallback to the original path if scanning fails
      patterns = [`${this.sessionRootDir}/jarvis/sessions/*.jsonl`, `${this.sessionRootDir}/jarvis/sessions/*.jsonl.deleted.*`, `${this.sessionRootDir}/jarvis/sessions/*.jsonl.reset.*`];
    }

    console.log(`[FileWatcher] Starting to watch patterns:`, patterns);

    this.watcher = chokidar.watch(patterns, {
      ignored: /node_modules/,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    this.watcher
      .on('add', (path: string) => {
        if (path.endsWith('.jsonl') || path.includes('.jsonl.deleted.') || path.includes('.jsonl.reset.')) {
          console.log(`[FileWatcher] File added: ${path}`);
          this.emit('file-added', path);
        }
      })
      .on('change', (path: string) => {
        if (path.endsWith('.jsonl')) {
          console.log(`[FileWatcher] File changed: ${path}`);
          this.emit('file-changed', path);
        }
      })
      .on('unlink', (path: string) => {
        console.log(`[FileWatcher] File removed: ${path}`);
        this.emit('file-removed', path);
      });
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}
