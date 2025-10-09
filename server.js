import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 9999;

const staticPath = process.cwd();

app.use(express.static(staticPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

// 本地开发时启动服务器
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Serving files from: ${staticPath}`);
  });
}

export default app;
