const { MongoClient } = require('mongodb');

const url = new URL(process.env.MONGODB_URI);
const dbName =
  process.env.MONGODB_DB || url.pathname.replace(/^\//, '') || 'Discord_Bot';

let client;
let bans;
let warnings;

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
  close
};
