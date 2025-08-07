const DEFAULT_JOIN_THRESHOLD = { count: 5, seconds: 10 };
const DEFAULT_MSG_THRESHOLD = 5;

let antiRaidSettings;
let antiRaidEvents;

function ensureSettings() {
  if (!antiRaidSettings) {
    console.warn('AntiRaidSettings collection is not initialized. Call init() first.');
    throw new Error('Database not initialized');
  }
}

function ensureEvents() {
  if (!antiRaidEvents) {
    console.warn('AntiRaidEvents collection is not initialized. Call init() first.');
    throw new Error('Database not initialized');
  }
}

function init(db) {
  if (!db) throw new Error('antiRaid.init called without db');
  antiRaidSettings = db.collection('antiRaidSettings');
  antiRaidEvents = db.collection('antiRaidEvents');
}

async function getAntiRaidSettings(guildId) {
  ensureSettings();
  const doc = await antiRaidSettings.findOne({ guildId });
  if (!doc) {
    return {
      guildId,
      joinThreshold: { ...DEFAULT_JOIN_THRESHOLD },
      msgThreshold: DEFAULT_MSG_THRESHOLD,
      whitelist: [],
      verifyQuestion: null
    };
  }
  return doc;
}

async function setJoinThreshold(guildId, count, seconds) {
  ensureSettings();
  await antiRaidSettings.updateOne(
    { guildId },
    { $set: { guildId, joinThreshold: { count, seconds } } },
    { upsert: true }
  );
}

async function setMsgThreshold(guildId, count) {
  ensureSettings();
  await antiRaidSettings.updateOne(
    { guildId },
    { $set: { guildId, msgThreshold: count } },
    { upsert: true }
  );
}

async function addWhitelistDomain(guildId, domain) {
  ensureSettings();
  await antiRaidSettings.updateOne(
    { guildId },
    { $addToSet: { whitelist: domain } },
    { upsert: true }
  );
}

async function removeWhitelistDomain(guildId, domain) {
  ensureSettings();
  await antiRaidSettings.updateOne(
    { guildId },
    { $pull: { whitelist: domain } }
  );
}

async function setVerifyQuestion(guildId, question, answer) {
  ensureSettings();
  await antiRaidSettings.updateOne(
    { guildId },
    { $set: { guildId, verifyQuestion: { question, answer } } },
    { upsert: true }
  );
}

async function logAntiRaidEvent(guildId, type, details) {
  ensureEvents();
  const doc = { guildId, type, details, createdAt: new Date() };
  await antiRaidEvents.insertOne(doc);
  return doc;
}

module.exports = {
  init,
  getAntiRaidSettings,
  setJoinThreshold,
  setMsgThreshold,
  addWhitelistDomain,
  removeWhitelistDomain,
  setVerifyQuestion,
  logAntiRaidEvent
};
