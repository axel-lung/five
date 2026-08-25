const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Sert l'export web statique de l'application.
 *
 * `app.json` declare `web.output: "single"` : l'export est une SPA, dont
 * toutes les routes doivent retomber sur index.html. Un serveur de fichiers
 * nu renverrait 404 sur /sessions/<id>, et les parcours ne testeraient que
 * l'accueil.
 */
const ROOT = path.join(__dirname, '..', 'dist');
const PORT = Number(process.env.PORT || 3002);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
};

http
  .createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    // path.normalize neutralise les '..' avant que la requete n'atteigne le
    // disque : la cible arrive de l'exterieur.
    const target = path.join(ROOT, path.normalize(url));

    const file =
      target.startsWith(ROOT) && fs.existsSync(target) && fs.statSync(target).isFile()
        ? target
        : path.join(ROOT, 'index.html');

    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, () => console.log(`Export web servi sur http://localhost:${PORT}`));
