const mongoose = require('mongoose');
const Ban = require('./banModel');
const { run: testMongoConnection } = require('./mongoClient');

async function init() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.warn('MONGODB_URI is not defined.');
    return;
  }
  try {
    await mongoose.connect(mongoUri, { dbName: 'Discord_Bot' });
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
}

function addBan(data) {
  const ban = new Ban(data);
  return ban.save();
}

function removeBan(guildId, userId) {
  return Ban.deleteOne({ guildId, userId });
}

function getBan(guildId, userId) {
  return Ban.findOne({ guildId, userId });
}

module.exports = { init, addBan, removeBan, getBan, Ban, testMongoConnection };
