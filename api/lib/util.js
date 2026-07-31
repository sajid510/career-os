const admin = require('firebase-admin');

if (!admin.apps.length) {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (sa) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(sa)) });
  } else {
    admin.initializeApp();
  }
}
const db = admin.firestore();

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  const s = Math.random().toString(36).slice(2, 8);
  return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + s;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function isoFromLocal(dt) {
  return dt.toISOString();
}

function localNow() {
  const now = new Date();
  return new Date(now.getTime() + 6 * 60 * 60 * 1000); // Asia/Dhaka fixed +6
}

function addDaysLocal(days) {
  const d = localNow();
  d.setDate(d.getDate() + days);
  return d;
}

function toLocalDateStr(iso) {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + 6 * 60 * 60 * 1000);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function daysUntil(iso) {
  if (!iso) return null;
  const target = new Date(iso);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((end - start) / 86400000);
}

function inDays(iso) {
  const d = daysUntil(iso);
  if (d === null) return '?';
  if (d < 0) return 'D+' + (-d) + ' past';
  if (d === 0) return 'TODAY';
  if (d === 1) return 'tomorrow';
  return 'in ' + d + 'd';
}

function humanDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
}

async function getDoc(path) {
  const snap = await db.doc(path).get();
  return snap.exists ? snap.data() : null;
}

async function setDoc(path, data, merge) {
  await db.doc(path).set(data, { merge: merge === undefined ? true : merge });
  return data;
}

async function addDoc(coll, data) {
  const ref = await db.collection(coll).add(Object.assign({}, data));
  return { id: ref.id, ...data };
}

async function listDocs(coll, orderBy, limit) {
  let q = db.collection(coll);
  if (orderBy) q = q.orderBy(orderBy);
  if (limit) q = q.limit(limit);
  const snap = await q.get();
  const out = [];
  snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
  return out;
}

async function queryDocs(coll, field, op, value) {
  const snap = await db.collection(coll).where(field, op, value).get();
  const out = [];
  snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
  return out;
}

async function deleteDoc(path) {
  await db.doc(path).delete();
}

module.exports = {
  db,
  admin,
  nowIso,
  makeId,
  isoFromLocal,
  localNow,
  addDaysLocal,
  toLocalDateStr,
  daysUntil,
  inDays,
  humanDate,
  getDoc,
  setDoc,
  addDoc,
  listDocs,
  queryDocs,
  deleteDoc,
};
