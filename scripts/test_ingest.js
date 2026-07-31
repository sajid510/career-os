const fs = require('fs');
const path = require('path');

const HUB = process.env.HUB_URL || 'http://localhost:3999';
const TOKEN = process.env.HUB_TOKEN || '';
const text = fs.readFileSync('E:\\Important document\\complete-profile\\Fully_Funded_Masters_Roadmap_Complete.md', 'utf8');

(async () => {
  const body = {
    text: text.slice(0, 60000),
    graduationDate: '2027-12-31',
  };
  const r = await fetch(HUB + '/api/plan/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hub-token': TOKEN },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  console.log('STATUS', r.status);
  console.log(txt.slice(0, 3000));
})().catch((e) => { console.error('ERR', e); process.exit(1); });
