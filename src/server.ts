import express from 'express';
import cors from 'cors';
import { DocumentWebSocketServer } from './index';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '8081', 10);

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const wss = new DocumentWebSocketServer();
wss.listen(PORT);

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing server...');
  wss.close();
  process.exit(0);
});

export { app, wss }; 