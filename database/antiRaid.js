const DEFAULT_JOIN_THRESHOLD = { count: 5, seconds: 10 };
const DEFAULT_MSG_THRESHOLD = 5;
const DEFAULT_SHADOW_MUTE_THRESHOLD = 1;
const DEFAULT_QUARANTINE_THRESHOLD = 3;
const DEFAULT_LOCKDOWN_THRESHOLD = 20; // events per minute

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
      shadowMuteThreshold: DEFAULT_SHADOW_MUTE_THRESHOLD,
      quarantineThreshold: DEFAULT_QUARANTINE_THRESHOLD,
      lockdownThreshold: DEFAULT_LOCKDOWN_THRESHOLD,
      muteRoleId: null,
      suspectRoleId: null,
      whitelist: [],
      verifyQuestion: null
    };
  }
  return {
    guildId,
    joinThreshold: doc.joinThreshold || { ...DEFAULT_JOIN_THRESHOLD },
    msgThreshold: doc.msgThreshold ?? DEFAULT_MSG_THRESHOLD,
    shadowMuteThreshold: doc.shadowMuteThreshold ?? DEFAULT_SHADOW_MUTE_THRESHOLD,
    quarantineThreshold: doc.quarantineThreshold ?? DEFAULT_QUARANTINE_THRESHOLD,
    lockdownThreshold: doc.lockdownThreshold ?? DEFAULT_LOCKDOWN_THRESHOLD,
    muteRoleId: doc.muteRoleId || null,
    suspectRoleId: doc.suspectRoleId || null,
    whitelist: doc.whitelist || [],
    verifyQuestion: doc.verifyQuestion || null
  };
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

async function setShadowMuteThreshold(guildId, count) {
  ensureSettings();
  await antiRaidSettings.updateOne(
    { guildId },
    { $set: { guildId, shadowMuteThreshold: count } },
    { upsert: true }
  );
}

async function setQuarantineThreshold(guildId, count) {
  ensureSettings();
  await antiRaidSettings.updateOne(
    { guildId },
    { $set: { guildId, quarantineThreshold: count } },
    { upsert: true }
  );
}

async function setLockdownThreshold(guildId, count) {
  ensureSettings();
  await antiRaidSettings.updateOne(
    { guildId },
    { $set: { guildId, lockdownThreshold: count } },
    { upsert: true }
  );
}

async function setMuteRole(guildId, roleId) {
  ensureSettings();
  await antiRaidSettings.updateOne(
    { guildId },
    { $set: { guildId, muteRoleId: roleId } },
    { upsert: true }
  );
}

async function setSuspectRole(guildId, roleId) {
  ensureSettings();
  await antiRaidSettings.updateOne(
    { guildId },
    { $set: { guildId, suspectRoleId: roleId } },
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
  setShadowMuteThreshold,
  setQuarantineThreshold,
  setLockdownThreshold,
  setMuteRole,
  setSuspectRole,
  addWhitelistDomain,
  removeWhitelistDomain,
  setVerifyQuestion,
  logAntiRaidEvent
};
