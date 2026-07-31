const http = require('http');
const fs = require('fs');
const path = require('path');

const CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const REDIRECT = 'http://localhost:8080';
const PORT = 8080;
const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/cloudplatformprojects.readonly',
  'https://www.googleapis.com/auth/firebase',
  'https://www.googleapis.com/auth/cloud-platform',
].join(' ');

const DIR = __dirname;
const OUT = path.join(DIR, 'firebase_oauth_out.txt');
const CODE_FILE = path.join(DIR, 'firebase_code.txt');
function log(msg) { fs.appendFileSync(OUT, msg + '\n'); }

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?client_id=' + CLIENT_ID +
  '&redirect_uri=' + encodeURIComponent(REDIRECT) +
  '&response_type=code&scope=' + encodeURIComponent(SCOPES) +
  '&access_type=offline&prompt=consent';

const server = http.createServer((req, res) => {
  const url = req.url || '';
  const qs = new URLSearchParams(url.split('?')[1] || '');
  const code = qs.get('code');
  const err = qs.get('error');
  if (code) {
    fs.writeFileSync(CODE_FILE, code);
    log('AUTH_CODE_SAVED');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h3>Authorization received. You can close this tab.</h3>');
    server.close();
    setTimeout(() => process.exit(0), 500);
  } else if (err) {
    log('OAUTH_ERROR=' + err + ' ' + (qs.get('error_description') || ''));
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h3>Authorization failed: ' + err + '</h3>');
    server.close();
    process.exit(2);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  log('LISTENING_ON_PORT_8080');
  log('AUTH_URL=' + authUrl);
  log('OPEN_THIS_URL_AND_APPROVE');
});
server.on('error', (e) => { log('SERVER_ERR: ' + e.message); process.exit(6); });
