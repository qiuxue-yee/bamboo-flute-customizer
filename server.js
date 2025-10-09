import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 9999;

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  if (typeof global.__DEV__ === 'undefined') global.__DEV__ = false;
  if (global.__DEV__) console.log(`Server running at http://localhost:${PORT}`);
  if (global.__DEV__) console.log(`Serving files from: ${__dirname}`);
});
