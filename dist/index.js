"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const ws_1 = require("ws");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 8081;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'https://real-time-text-editor-amber.vercel.app',
    'https://real-time-text-editor-git-bug-cee6e5-johanns-projects-6ef4f9e7.vercel.app'
];
// Add CORS and health check endpoints
app.use((0, cors_1.default)({
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true
}));
// Health check endpoint for Railway
app.get('/health', (_, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});
// Metrics endpoint
app.get('/metrics', (_, res) => {
    res.json({
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
    });
});
// Start HTTP server
const server = app.listen(PORT, () => {
    console.log(`HTTP server running on port ${PORT}`);
});
// Initialize WebSocket server
const wss = new ws_1.WebSocketServer({ server });
wss.on('connection', (ws) => {
    console.log('Client connected');
    ws.on('message', (message) => {
        // Broadcast to all clients
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === ws_1.WebSocketServer.OPEN) {
                client.send(message.toString());
            }
        });
    });
    ws.on('close', () => {
        console.log('Client disconnected');
    });
});
// Handle graceful shutdown
const shutdown = () => {
    console.log('Shutting down servers...');
    server.close(() => {
        console.log('HTTP server closed');
        wss.close(() => {
            console.log('WebSocket server closed');
            process.exit(0);
        });
    });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
