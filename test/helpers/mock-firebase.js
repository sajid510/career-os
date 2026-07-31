'use strict';

// In-memory Firestore stub + firebase-admin interception so the hub modules
// can be unit-tested without real credentials or network access.
const Module = require('module');

function makeDb() {
  const docs = new Map();
  let counter = 0;
  return {
    _reset() { docs.clear(); },
    doc(path) {
      return {
        get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }),
        set: async (data) => { docs.set(path, data); },
        delete: async () => { docs.delete(path); },
      };
    },
    collection(name) {
      const prefix = name + '/';
      return {
        add: async (data) => {
          const id = 'id' + counter++;
          docs.set(prefix + id, data);
          return { id };
        },
        get: async () => {
          const entries = [];
          for (const [k, v] of docs) {
            if (k.startsWith(prefix)) entries.push({ id: k.slice(prefix.length), data: v });
          }
          return { forEach: (cb) => entries.forEach((e) => cb({ id: e.id, data: () => e.data })) };
        },
      };
    },
  };
}

function install(db) {
  const origLoad = Module._load;
  Module._load = function (request) {
    if (request === 'firebase-admin') {
      return {
        apps: [],
        initializeApp: () => {},
        credential: { cert: () => ({}) },
        firestore: () => db,
        messaging: () => ({ sendEachForMulticast: async () => ({ successCount: 0, responses: [] }) }),
      };
    }
    return origLoad.apply(this, arguments);
  };
}

module.exports = { makeDb, install };
