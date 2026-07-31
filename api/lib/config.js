const { getDoc, setDoc } = require('./util');

const SETTINGS_PATH = 'settings/hub';

const DEFAULTS = {
  hubName: 'Career OS',
  hubTagline: 'Your all-in-one career command center',
  ownerEmail: 'sadnansajid355@gmail.com',
  ownerPhone: '+880 1604-816949',
  hubToken: '',
  geminiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: 'gemini-flash-latest',
  careerIoWebhook: '',
  careerIoSecret: '',
  robotDbUrl: 'https://robot-oda-dashboard-default-rtdb.firebaseio.com',
  careerIoSpreadsheetUrl: '',
  timezone: 'Asia/Dhaka',
  reminderLeadMinutes: 60,
  dailyBriefTime: '07:00',
  classroomClientId: '',
  classroomClientSecret: '',
  classroomRefreshToken: '',
  classroomAccessToken: '',
  classroomTokenExpiry: 0,
  classroomEmail: '',
  systemsEnabled: {
    careerIo: true,
    teamDashboard: true,
    robowatch: true,
    eeeAcademicOS: true,
    newsPulse: true,
  },
  initialized: false,
};

async function getSettings() {
  const s = await getDoc(SETTINGS_PATH);
  const clean = {};
  if (s) {
    Object.keys(s).forEach((k) => {
      if (s[k] !== '' && s[k] !== null && s[k] !== undefined) clean[k] = s[k];
    });
  }
  return Object.assign({}, DEFAULTS, clean);
}

async function saveSettings(patch) {
  const cur = await getSettings();
  const next = Object.assign({}, cur, patch);
  await setDoc(SETTINGS_PATH, next, false);
  return next;
}

async function setHubToken(token) {
  await setDoc(SETTINGS_PATH, { hubToken: token }, true);
}

async function getHubToken() {
  const s = await getSettings();
  return s.hubToken;
}

module.exports = {
  SETTINGS_PATH,
  DEFAULTS,
  getSettings,
  saveSettings,
  setHubToken,
  getHubToken,
};
