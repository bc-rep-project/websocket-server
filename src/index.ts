import express from 'express';
import cors from 'cors';
import { DocumentWebSocketServer } from './websocket';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8081;

// Add CORS and health check endpoints
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://real-time-text-editor-amber.vercel.app',
    'https://real-time-text-editor-git-bug-cee6e5-johanns-projects-6ef4f9e7.vercel.app'
  ],
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
const wss = new DocumentWebSocketServer(Number(PORT));

// Start HTTP server
app.listen(PORT, () => {
  console.log(`HTTP server running on port ${PORT}`);
  console.log(`WebSocket server running on port ${PORT}`);
});

// Handle graceful shutdown
const shutdown = () => {
  console.log('Shutting down servers...');
  wss.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown); 