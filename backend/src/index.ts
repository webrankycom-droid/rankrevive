import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
