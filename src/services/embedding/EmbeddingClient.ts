/**
 * EmbeddingClient
 *
 * TypeScript client for the ruri-v3-70m embedding server.
 * Communicates via HTTP with the Python embedding service.
 */

import { spawn, ChildProcess } from 'child_process';
import { logger } from '../../utils/logger.js';
import { SettingsDefaultsManager, type SettingsDefaults } from '../../shared/SettingsDefaultsManager.js';
import { USER_SETTINGS_PATH, PLUGIN_SCRIPTS_DIR } from '../../shared/paths.js';
import path from 'path';

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
}

export interface HealthResponse {
  status: string;
  model: string;
  dimension: number;
}

export class EmbeddingClient {
  private host: string;
  private port: number;
  private serverProcess: ChildProcess | null = null;
  private ready: boolean = false;
  private modelName: string;

  constructor(host: string = '127.0.0.1', port: number = 37778, modelName: string = 'cl-nagoya/ruri-v3-70m') {
    this.host = host;
    this.port = port;
    this.modelName = modelName;
  }

  /**
   * Get the base URL for the embedding server
   */
  private get baseUrl(): string {
    return `http://${this.host}:${this.port}`;
  }

  /**
   * Check if the embedding server is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json() as HealthResponse;
      return data.status === 'ok';
    } catch (error) {
      return false;
    }
  }

  /**
   * Wait for the embedding server to become healthy
   */
  private async waitForServer(maxRetries: number = 60, retryInterval: number = 1000): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
      if (await this.isHealthy()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
    return false;
  }

  /**
   * Start the embedding server as a subprocess
   */
  async startServer(): Promise<boolean> {
    // Check if already running
    if (await this.isHealthy()) {
      logger.info('EMBEDDING', 'Embedding server already running');
      this.ready = true;
      return true;
    }

    logger.info('EMBEDDING', 'Starting embedding server...', {
      model: this.modelName,
      port: this.port
    });

    // Get Python version from settings
    const settings = SettingsDefaultsManager.loadFromFile(USER_SETTINGS_PATH);
    const pythonVersion = settings.CLAUDE_MEM_PYTHON_VERSION;

    // Path to the embedding server script (in plugin/scripts/embedding/)
    const scriptPath = path.join(PLUGIN_SCRIPTS_DIR, 'embedding', 'embedding_server.py');

    // Start the server using uvx with required packages
    const args = [
      '--python', pythonVersion,
      '--with', 'torch',
      '--with', 'sentence-transformers',
      '--with', 'sentencepiece',
      '--with', 'flask',
      '--with', 'transformers>=4.48.0',
      '--with', 'protobuf',
      'python', scriptPath,
      '--port', this.port.toString(),
      '--host', this.host,
      '--model', this.modelName
    ];

    logger.debug('EMBEDDING', 'Spawning uvx with args', { args: args.join(' ') });

    try {
      this.serverProcess = spawn('uvx', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
      });

      // Log server output
      this.serverProcess.stdout?.on('data', (data) => {
        const line = data.toString().trim();
        if (line) {
          logger.debug('EMBEDDING', 'Server stdout', { output: line });
        }
      });

      this.serverProcess.stderr?.on('data', (data) => {
        const line = data.toString().trim();
        if (line) {
          // Filter out progress bars and download messages
          if (!line.includes('Downloading') && !line.includes('%|')) {
            logger.debug('EMBEDDING', 'Server stderr', { output: line });
          }
        }
      });

      this.serverProcess.on('error', (error) => {
        logger.error('EMBEDDING', 'Server process error', {}, error);
      });

      this.serverProcess.on('exit', (code) => {
        logger.info('EMBEDDING', 'Server process exited', { code });
        this.ready = false;
        this.serverProcess = null;
      });

      // Wait for server to become healthy
      logger.info('EMBEDDING', 'Waiting for embedding server to become ready (this may take a while on first run)...');
      const healthy = await this.waitForServer(120, 2000); // 4 minutes timeout for model download

      if (healthy) {
        logger.success('EMBEDDING', 'Embedding server is ready', {
          model: this.modelName,
          port: this.port
        });
        this.ready = true;
        return true;
      } else {
        logger.error('EMBEDDING', 'Embedding server failed to become healthy');
        this.stopServer();
        return false;
      }
    } catch (error) {
      logger.error('EMBEDDING', 'Failed to start embedding server', {}, error as Error);
      return false;
    }
  }

  /**
   * Stop the embedding server
   */
  stopServer(): void {
    if (this.serverProcess) {
      logger.info('EMBEDDING', 'Stopping embedding server');
      this.serverProcess.kill('SIGTERM');
      this.serverProcess = null;
      this.ready = false;
    }
  }

  /**
   * Compute embeddings for a list of texts
   */
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    // Ensure server is running
    if (!this.ready) {
      const started = await this.startServer();
      if (!started) {
        throw new Error('Failed to start embedding server');
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ texts }),
        signal: AbortSignal.timeout(60000) // 60 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Embedding request failed: ${response.status} ${errorText}`);
      }

      const data = await response.json() as EmbeddingResponse;

      logger.debug('EMBEDDING', 'Embeddings computed', {
        textCount: texts.length,
        embeddingDim: data.embeddings[0]?.length
      });

      return data.embeddings;
    } catch (error) {
      logger.error('EMBEDDING', 'Failed to compute embeddings', {
        textCount: texts.length
      }, error as Error);
      throw error;
    }
  }

  /**
   * Get the embedding dimension
   */
  async getDimension(): Promise<number> {
    if (!this.ready) {
      const started = await this.startServer();
      if (!started) {
        throw new Error('Failed to start embedding server');
      }
    }

    const response = await fetch(`${this.baseUrl}/health`);
    const data = await response.json() as HealthResponse;
    return data.dimension;
  }

  /**
   * Check if client is ready
   */
  isReady(): boolean {
    return this.ready;
  }
}
