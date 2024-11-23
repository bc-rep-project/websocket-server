"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentWebSocketServer = void 0;
const ws_1 = require("ws");
const cookie_1 = require("cookie");
const jwt_1 = require("next-auth/jwt");
class DocumentWebSocketServer {
    constructor(port) {
        this.wss = new ws_1.WebSocketServer({
            port,
            verifyClient: async ({ req }, done) => {
                try {
                    const cookieHeader = req.headers.cookie || '';
                    const cookies = (0, cookie_1.parse)(cookieHeader);
                    const token = await (0, jwt_1.getToken)({
                        req: Object.assign(req, { cookies }),
                        secret: process.env.NEXTAUTH_SECRET
                    });
                    if (!token) {
                        done(false, 401, 'Unauthorized');
                        return;
                    }
                    done(true);
                }
                catch (error) {
                    console.error('WebSocket auth error:', error);
                    done(false, 500, 'Internal Server Error');
                }
            }
        });
        this.setupWebSocketServer();
        this.setupPingInterval();
        console.log(`WebSocket server initialized on port ${port}`);
    }
    setupWebSocketServer() {
        this.wss.on('connection', (ws, req) => {
            ws.isAlive = true;
            console.log('Client connected');
            ws.on('pong', () => {
                ws.isAlive = true;
            });
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.broadcastMessage(ws, message);
                }
                catch (error) {
                    console.error('Error handling message:', error);
                }
            });
            ws.on('close', () => {
                console.log('Client disconnected');
            });
        });
    }
    setupPingInterval() {
        this.pingInterval = setInterval(() => {
            this.wss.clients.forEach((client) => {
                const wsClient = client;
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
    broadcastMessage(sender, message) {
        this.wss.clients.forEach((client) => {
            const wsClient = client;
            if (wsClient !== sender &&
                wsClient.readyState === ws_1.WebSocket.OPEN &&
                wsClient.documentId === sender.documentId) {
                wsClient.send(JSON.stringify(message));
            }
        });
    }
    close() {
        clearInterval(this.pingInterval);
        this.wss.close();
    }
}
exports.DocumentWebSocketServer = DocumentWebSocketServer;
