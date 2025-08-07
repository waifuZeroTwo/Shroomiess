require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('./database');

// Global error handlers to avoid silent crashes
process.on('unhandledRejection', err => console.error('Unhandled promise rejection:', err));
process.on('uncaughtException', err => console.error('Uncaught exception:', err));

// Dynamically load features
const features = {};
const featuresPath = path.join(__dirname, 'features');
if (fs.existsSync(featuresPath)) {
  for (const file of fs.readdirSync(featuresPath)) {
    if (file.endsWith('.js')) {
      const name = path.basename(file, '.js');
      features[name] = require(path.join(featuresPath, file));
    }
  }
}
// Shared command map for help text
const commands = new Map();

// Create Discord client with desired intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction]
});

client.features = features;

// Allow each feature to register itself
for (const feature of Object.values(features)) {
  if (typeof feature.register === 'function') {
    feature.register(client, commands);
  }
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
});

async function start() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    throw new Error('DISCORD_BOT_TOKEN is not defined in environment variables.');
  }

  try {
    await db.init();
  } catch (err) {
    console.error('Failed to initialize database:', err);
    throw err;
  }

  try {
    await client.login(token);
  } catch (err) {
    console.error('Failed to login to Discord:', err);
  }
}

start().catch((err) => {
  console.error('Bot failed to start:', err);
});

module.exports = { client };
