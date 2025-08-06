const { MongoClient } = require('mongodb');

let client;
let bans;

async function init() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.warn('MONGODB_URI is not defined.');
    return;
  }
  client = new MongoClient(mongoUri);
  try {
    await client.connect();
    const db = client.db('Discord_Bot');
    bans = db.collection('ban');
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
}

async function addBan(data) {
  const { userId, guildId } = data;
  await bans.updateOne({ userId, guildId }, { $set: data }, { upsert: true });
}

function removeBan(guildId, userId) {
  return bans.deleteOne({ userId, guildId });
}

function getBan(guildId, userId) {
  return bans.findOne({ userId, guildId });
}

async function getActiveBans() {
  return await bans.find({ expiresAt: { $gt: new Date() } }).toArray();
}

async function close() {
  await client.close();
}

module.exports = { init, addBan, removeBan, getBan, getActiveBans, close };
