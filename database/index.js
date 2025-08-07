const { MongoClient } = require('mongodb');

const url = new URL(process.env.MONGODB_URI);
const dbName =
  process.env.MONGODB_DB || url.pathname.replace(/^\//, '') || 'Discord_Bot';

let client;
let bans;
let warnings;
let mutes;
let guildSettings;
let birthdays;
let reputations;
let repTransactions;
let economy;
// Anti-raid collections
const antiRaid = require('./antiRaid');
const { init: initAntiRaid, ...antiRaidHelpers } = antiRaid;

const DEFAULT_BIRTHDAY_FORMAT = 'YYYY-MM-DD';

function ensureBans() {
  if (!bans) {
    console.warn('Bans collection is not initialized. Call init() first.');
    throw new Error('Database not initialized');
  }
}

function ensureWarnings() {
  if (!warnings) {
    console.warn('Warnings collection is not initialized. Call init() first.');
    throw new Error('Database not initialized');
  }
}

function ensureMutes() {
  if (!mutes) {
    console.warn('Mutes collection is not initialized. Call init() first.');
    throw new Error('Database not initialized');
  }
}

function ensureGuildSettings() {
  if (!guildSettings) {
    console.warn('GuildSettings collection is not initialized. Call init() first.');
    throw new Error('Database not initialized');
  }
}

function ensureBirthdays() {
  if (!birthdays) {
    console.warn('Birthdays collection is not initialized. Call init() first.');
    throw new Error('Database not initialized');
  }
}

function ensureReputations() {
  if (!reputations) {
    console.warn('Reputations collection is not initialized. Call init() first.');
    throw new Error('Database not initialized');
  }
}

function ensureRepTransactions() {
  if (!repTransactions) {
    console.warn('RepTransactions collection is not initialized. Call init() first.');
    throw new Error('Database not initialized');
  }
}

function ensureEconomy() {
  if (!economy) {
    console.warn('Economy collection is not initialized. Call init() first.');
    throw new Error('Database not initialized');
  }
}

async function init() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.warn('MONGODB_URI is not defined.');
    throw new Error('MONGODB_URI is not defined');
  }
  client = new MongoClient(mongoUri);
  try {
    await client.connect();
    const db = client.db(dbName);
    bans = db.collection('ban');
    warnings = db.collection('warnings');
    mutes = db.collection('mutes');
    guildSettings = db.collection('guildSettings');
    birthdays = db.collection('birthdays');
    reputations = db.collection('reputations');
    repTransactions = db.collection('repTransactions');
    economy = db.collection('economy');
    // initialize anti-raid collections
    initAntiRaid(db); // must supply the db instance
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw err;
  }
}

async function addBan(data) {
  ensureBans();
  const { userId, guildId } = data;
  await bans.updateOne({ userId, guildId }, { $set: data }, { upsert: true });
}

function removeBan(guildId, userId) {
  ensureBans();
  return bans.deleteOne({ userId, guildId });
}

function getBan(guildId, userId) {
  ensureBans();
  return bans.findOne({ userId, guildId });
}

async function getActiveBans() {
  ensureBans();
  return await bans.find({ expiresAt: { $gt: new Date() } }).toArray();
}

function getBanCollection() {
  ensureBans();
  return bans;
}

async function addWarning(data) {
  ensureWarnings();
  const doc = { ...data, createdAt: new Date() };
  await warnings.insertOne(doc);
  return doc;
}

function listWarnings(guildId, userId) {
  ensureWarnings();
  return warnings.find({ guildId, userId }).sort({ createdAt: 1 }).toArray();
}

function clearWarnings(guildId, userId) {
  ensureWarnings();
  return warnings.deleteMany({ guildId, userId });
}

async function addMute(data) {
  ensureMutes();
  const { userId, guildId } = data;
  await mutes.updateOne({ userId, guildId }, { $set: data }, { upsert: true });
}

function removeMute(guildId, userId) {
  ensureMutes();
  return mutes.deleteOne({ userId, guildId });
}

async function getActiveMutes() {
  ensureMutes();
  return await mutes.find({ expiresAt: { $gt: new Date() } }).toArray();
}

async function setBirthday({ guildId, userId, date }) {
  ensureBirthdays();
  await birthdays.updateOne(
    { guildId, userId },
    { $set: { guildId, userId, date } },
    { upsert: true }
  );
}

function clearBirthday(guildId, userId) {
  ensureBirthdays();
  return birthdays.deleteOne({ guildId, userId });
}

function listBirthdays(guildId) {
  ensureBirthdays();
  return birthdays.find({ guildId }).toArray();
}

async function setModLogChannel(guildId, channelId) {
  ensureGuildSettings();
  await guildSettings.updateOne(
    { guildId },
    { $set: { guildId, modLogChannelId: channelId } },
    { upsert: true }
  );
}

async function getModLogChannel(guildId) {
  ensureGuildSettings();
  const doc = await guildSettings.findOne({ guildId });
  return doc ? doc.modLogChannelId : null;
}

async function setBirthdayChannel(guildId, channelId) {
  ensureGuildSettings();
  await guildSettings.updateOne(
    { guildId },
    { $set: { guildId, birthdayChannelId: channelId } },
    { upsert: true }
  );
}

async function getBirthdayChannel(guildId) {
  ensureGuildSettings();
  const doc = await guildSettings.findOne({ guildId });
  return doc ? doc.birthdayChannelId : null;
}

async function setBirthdayRole(guildId, roleId) {
  ensureGuildSettings();
  await guildSettings.updateOne(
    { guildId },
    { $set: { guildId, birthdayRoleId: roleId } },
    { upsert: true }
  );
}

async function getBirthdayRole(guildId) {
  ensureGuildSettings();
  const doc = await guildSettings.findOne({ guildId });
  return doc ? doc.birthdayRoleId : null;
}

async function setBirthdayFormat(guildId, format) {
  ensureGuildSettings();
  await guildSettings.updateOne(
    { guildId },
    { $set: { guildId, birthdayFormat: format } },
    { upsert: true }
  );
}

async function getBirthdayFormat(guildId) {
  ensureGuildSettings();
  const doc = await guildSettings.findOne({ guildId });
  return doc && doc.birthdayFormat ? doc.birthdayFormat : DEFAULT_BIRTHDAY_FORMAT;
}

async function awardReputation({ guildId, fromUserId, toUserId, reason }) {
  ensureReputations();
  ensureRepTransactions();
  const updateResult = await reputations.findOneAndUpdate(
    { guildId, userId: toUserId },
    {
      $inc: { points: 1 },
      $setOnInsert: { badges: [] }
    },
    { upsert: true, returnDocument: 'after' }
  );
  const transaction = {
    guildId,
    fromUserId,
    toUserId,
    reason,
    createdAt: new Date()
  };
  await repTransactions.insertOne(transaction);
  return updateResult.value;
}

async function getReputation(guildId, userId) {
  ensureReputations();
  const doc = await reputations.findOne({ guildId, userId });
  if (!doc) {
    return { points: 0, badges: [] };
  }
  return {
    points: doc.points || 0,
    badges: doc.badges || []
  };
}

async function getLastRepTimestamp(guildId, fromUserId, toUserId) {
  ensureRepTransactions();
  const doc = await repTransactions.findOne(
    { guildId, fromUserId, toUserId },
    { sort: { createdAt: -1 } }
  );
  return doc ? doc.createdAt : null;
}

async function addBadge(guildId, userId, badge) {
  ensureReputations();
  await reputations.updateOne(
    { guildId, userId },
    { $addToSet: { badges: badge } }
  );
}

async function getBalance(guildId, userId) {
  ensureEconomy();
  const doc = await economy.findOne({ guildId, userId });
  return doc ? doc.balance || 0 : 0;
}

async function incrementBalance(guildId, userId, amount) {
  ensureEconomy();
  const updateResult = await economy.findOneAndUpdate(
    { guildId, userId },
    { $inc: { balance: amount } },
    { upsert: true, returnDocument: 'after' }
  );
  return updateResult.value.balance;
}

async function close() {
  await client.close();
}

module.exports = {
  init,
  addBan,
  removeBan,
  getBan,
  getActiveBans,
  getBanCollection,
  addWarning,
  listWarnings,
  clearWarnings,
  addMute,
  removeMute,
  getActiveMutes,
  setBirthday,
  clearBirthday,
  listBirthdays,
  setModLogChannel,
  getModLogChannel,
  setBirthdayChannel,
  getBirthdayChannel,
  setBirthdayRole,
  getBirthdayRole,
  setBirthdayFormat,
  getBirthdayFormat,
  awardReputation,
  getReputation,
  getLastRepTimestamp,
  addBadge,
  getBalance,
  incrementBalance,
  close,
  // anti-raid helpers
  ...antiRaidHelpers
};
