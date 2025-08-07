const { MongoClient } = require('mongodb');

const url = new URL(process.env.MONGODB_URI);
const dbName =
  process.env.MONGODB_DB || url.pathname.replace(/^\//, '') || 'Discord_Bot';

let client;
let bans;
let warnings;
let mutes;
let guildSettings;

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
  setModLogChannel,
  getModLogChannel,
  close
};
