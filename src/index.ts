import { WebSocket, WebSocketServer } from 'ws';
import { createServer } from 'http';
import { parse } from 'url';
import dotenv from 'dotenv';
import type { WebSocketClient } from '@/types/websocket';

dotenv.config();

export class DocumentWebSocketServer {
  private wss: WebSocketServer;
  private server: ReturnType<typeof createServer>;
  private clients: Map<string, Set<WebSocketClient>>;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.server = createServer();
    this.wss = new WebSocketServer({ server: this.server });
    this.clients = new Map();
    this.init();
  }

  private heartbeat(client: WebSocketClient) {
    client.isAlive = true;
  }

  private init() {
    this.wss.on('connection', async (ws: WebSocket, req) => {
      const wsClient = ws as WebSocketClient;
      const { query } = parse(req.url || '', true);
      const documentId = query.documentId as string;
      const userId = query.userId as string;

      if (!documentId || !userId) {
        wsClient.close();
        return;
      }

      // Initialize client
      wsClient.isAlive = true;
      wsClient.userId = userId;
      wsClient.documentId = documentId;

      // Add client to document room
      if (!this.clients.has(documentId)) {
        this.clients.set(documentId, new Set());
      }
      this.clients.get(documentId)?.add(wsClient);

      // Handle heartbeat
      wsClient.on('pong', () => this.heartbeat(wsClient));

      // Handle messages
      wsClient.on('message', (data: string) => {
        try {
          const message = JSON.parse(data);
          
          // Broadcast to all clients in the same document
          const documentClients = this.clients.get(documentId);
          if (documentClients) {
            documentClients.forEach(client => {
              if (client !== wsClient && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
              }
            });
          }
        } catch (error) {
          console.error('Error handling message:', error);
        }
      });

      // Handle client disconnect
      wsClient.on('close', () => {
        const documentClients = this.clients.get(documentId);
        if (documentClients) {
          documentClients.delete(wsClient);
          if (documentClients.size === 0) {
            this.clients.delete(documentId);
          }
        }
      });
    });

    // Setup heartbeat interval
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        const wsClient = ws as WebSocketClient;
        if (!wsClient.isAlive) {
          return wsClient.terminate();
        }
        wsClient.isAlive = false;
        wsClient.ping();
      });
    }, 30000);

    this.wss.on('close', () => {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
    });
  }

  public listen(port: number) {
    this.server.listen(port, () => {
      console.log(`WebSocket server is running on port ${port}`);
    });
  }

  public close() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.wss.close();
    this.server.close();
  }
}

export default DocumentWebSocketServer; 