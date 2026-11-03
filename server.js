// 짤 카드 스튜디오 정적 서버: node server.js → http://localhost:8000
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png' };

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const name = urlPath === '/' ? '/index.html' : urlPath;
  const file = path.join(root, path.normalize(name));
  if (!file.startsWith(root) || !/\.(html|js|css|jpg|png)$/.test(file)) {
    res.writeHead(404); return res.end('Not found');
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] });
    res.end(data);
  });
}).listen(8000, () => console.log('짤 카드 스튜디오: http://localhost:8000'));

