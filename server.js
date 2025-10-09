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

console.log('Static path:', staticPath);
console.log('__dirname:', __dirname);
console.log('process.cwd():', process.cwd());
console.log('VERCEL env:', process.env.VERCEL);

// 尝试多种静态文件路径
app.use(express.static(staticPath));
app.use(express.static(path.join(staticPath, 'assets')));

// API路由测试
app.get('/api/test', (req, res) => {
  res.json({ message: 'Express server is working', staticPath });
});

app.get('/', (req, res) => {
  console.log('Serving index.html from:', path.join(staticPath, 'index.html'));
  res.sendFile(path.join(staticPath, 'index.html'));
});

// 捕获所有其他路由
app.get('*', (req, res) => {
  console.log('File not found:', req.path, 'in directory:', staticPath);
  res.status(404).send('File not found');
});

// 本地开发时启动服务器
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    if (typeof global.__DEV__ === 'undefined') global.__DEV__ = false;
    if (global.__DEV__) console.log(`Server running at http://localhost:${PORT}`);
    if (global.__DEV__) console.log(`Serving files from: ${staticPath}`);
  });
}

// Vercel需要导出app实例
export default app;
