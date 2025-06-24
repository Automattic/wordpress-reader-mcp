import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { authRouter } from './auth.js';
import { discoveryRouter } from './discovery.js';

dotenv.config();

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.MCP_SERVER_URL,
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/auth', authRouter);
app.use('/.well-known', discoveryRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`OAuth handler running on port ${PORT}`);
});