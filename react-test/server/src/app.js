import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import tasksRoutes from './routes/tasksRoutes.js';
import authRoutes from './routes/authRoutes.js';

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL,
  }),
);

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Server is running' });
});

app.use('/tasks', tasksRoutes);
app.use('/auth', authRoutes);

export default app;
