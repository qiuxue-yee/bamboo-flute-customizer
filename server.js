import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 9999;

// 在Vercel环境中，尝试多种路径策略
function getStaticPath() {
  const possiblePaths = [
    process.cwd(), // Vercel项目根目录
    __dirname,     // 当前文件目录
    path.join(__dirname, '..'), // 上级目录
    '/var/task'    // Vercel函数环境
  ];

  for (const testPath of possiblePaths) {
    if (fs.existsSync(path.join(testPath, 'index.html'))) {
      console.log('Found index.html at:', testPath);
      return testPath;
    }
  }

  console.log('No valid static path found, using:', possiblePaths[0]);
  return possiblePaths[0];
}

const staticPath = getStaticPath();

console.log('=== SERVER STARTUP DEBUG ===');
console.log('Static path:', staticPath);
console.log('__dirname:', __dirname);
console.log('process.cwd():', process.cwd());
console.log('VERCEL env:', process.env.VERCEL);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Files in static path:', fs.readdirSync(staticPath));
console.log('========================');

// 优先设置静态文件服务
app.use(express.static(staticPath, {
  index: false, // 不要自动服务index.html，让我们手动控制
  setHeaders: (res, path) => {
    console.log('Serving static file:', path);
  }
}));

// 显式处理根路径
app.get('/', (req, res) => {
  const indexPath = path.join(staticPath, 'index.html');
  console.log('Trying to serve:', indexPath);
  console.log('File exists:', fs.existsSync(indexPath));

  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    console.error('index.html not found at:', indexPath);
    res.status(404).send('index.html not found');
  }
});

// 处理其他静态文件
app.get('/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(staticPath, filename);
  console.log('Trying to serve file:', filename, 'from:', filePath);

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    console.log('File not found:', filename);
    res.status(404).send(`File not found: ${filename}`);
  }
});

// 处理嵌套路径（如assets/）
app.get('/:dir/:filename', (req, res) => {
  const { dir, filename } = req.params;
  const filePath = path.join(staticPath, dir, filename);
  console.log('Trying to serve nested file:', dir, filename, 'from:', filePath);

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    console.log('Nested file not found:', dir, filename);
    res.status(404).send(`File not found: ${dir}/${filename}`);
  }
});

// API路由测试
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Express server is working',
    staticPath,
    files: fs.readdirSync(staticPath)
  });
});

// 捕获所有其他路由
app.get('*', (req, res) => {
  console.log('Wildcard route - file not found:', req.path, 'in directory:', staticPath);
  res.status(404).send(`File not found: ${req.path}`);
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
