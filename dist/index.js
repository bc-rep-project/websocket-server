"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentWebSocketServer = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const websocket_1 = require("./websocket");
Object.defineProperty(exports, "DocumentWebSocketServer", { enumerable: true, get: function () { return websocket_1.DocumentWebSocketServer; } });
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
// Initialize WebSocket server
const wss = new websocket_1.DocumentWebSocketServer(Number(PORT));
// Start HTTP server
const server = app.listen(PORT, () => {
    console.log(`HTTP server running on port ${PORT}`);
    console.log(`WebSocket server running on port ${PORT}`);
});
// Handle graceful shutdown
const shutdown = () => {
    console.log('Shutting down servers...');
    server.close(() => {
        console.log('HTTP server closed');
        wss.close();
        console.log('WebSocket server closed');
        process.exit(0);
    });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
