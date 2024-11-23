import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { parse } from 'cookie';
import { getToken } from 'next-auth/jwt';

interface WebSocketClient extends WebSocket {
  isAlive?: boolean;
  documentId?: string;
  userId?: string;
}

export class DocumentWebSocketServer {
  private wss: WebSocketServer;
  private pingInterval!: NodeJS.Timeout;

  constructor(port: number) {
    this.wss = new WebSocketServer({ 
      port,
      verifyClient: async ({ req }, done) => {
        try {
          const cookieHeader = req.headers.cookie || '';
          const cookies = parse(cookieHeader);
          
          const token = await getToken({ 
            req: Object.assign(req, { cookies }), 
            secret: process.env.NEXTAUTH_SECRET 
          });

          if (!token) {
            done(false, 401, 'Unauthorized');
            return;
          }
          done(true);
        } catch (error) {
          console.error('WebSocket auth error:', error);
          done(false, 500, 'Internal Server Error');
        }
      }
    });

    this.setupWebSocketServer();
    this.setupPingInterval();
    console.log(`WebSocket server initialized on port ${port}`);
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocketClient, req: IncomingMessage) => {
      ws.isAlive = true;
      console.log('Client connected');

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.broadcastMessage(ws, message);
        } catch (error) {
          console.error('Error handling message:', error);
        }
      });

      ws.on('close', () => {
        console.log('Client disconnected');
      });
    });
  }

  private setupPingInterval() {
    this.pingInterval = setInterval(() => {
      this.wss.clients.forEach((client: WebSocket) => {
        const wsClient = client as WebSocketClient;
        if (!wsClient.isAlive) {
          console.log('Client disconnected due to inactivity');
          wsClient.terminate();
          return;
        }
        wsClient.isAlive = false;
        wsClient.ping();
      });
    }, 30000);
  }

  private broadcastMessage(sender: WebSocketClient, message: any) {
    this.wss.clients.forEach((client: WebSocket) => {
      const wsClient = client as WebSocketClient;
      if (wsClient !== sender && 
          wsClient.readyState === WebSocket.OPEN && 
          wsClient.documentId === sender.documentId) {
        wsClient.send(JSON.stringify(message));
      }
    });
  }

  public close() {
    clearInterval(this.pingInterval);
    this.wss.close();
  }
} 