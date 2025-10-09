import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 9999;

// 在Vercel环境中，使用process.cwd()获取项目根目录
// 在本地环境中，使用__dirname
const staticPath = process.env.VERCEL ? process.cwd() : __dirname;

app.use(express.static(staticPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

app.listen(PORT, () => {
  if (typeof global.__DEV__ === 'undefined') global.__DEV__ = false;
  if (global.__DEV__) console.log(`Server running at http://localhost:${PORT}`);
  if (global.__DEV__) console.log(`Serving files from: ${staticPath}`);
});

// Vercel需要导出app实例
export default app;
