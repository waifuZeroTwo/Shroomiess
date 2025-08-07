require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('./database');

// Global error handlers to avoid silent crashes
process.on('unhandledRejection', err => console.error('Unhandled promise rejection:', err));
process.on('uncaughtException', err => console.error('Uncaught exception:', err));

// Dynamically load legacy prefix and slash command features
const prefixFeatures = {};
const prefixPath = path.join(__dirname, 'features', 'prefix');
if (fs.existsSync(prefixPath)) {
  for (const file of fs.readdirSync(prefixPath)) {
    if (file.endsWith('.js')) {
      const name = path.basename(file, '.js');
      prefixFeatures[name] = require(path.join(prefixPath, file));
    }
  }
}

const slashFeatures = {};
const slashPath = path.join(__dirname, 'features', 'slash');
if (fs.existsSync(slashPath)) {
  for (const file of fs.readdirSync(slashPath)) {
    if (file.endsWith('.js')) {
      const name = path.basename(file, '.js');
      slashFeatures[name] = require(path.join(slashPath, file));
    }
  }
}
// Shared command map for help text
const commands = new Map();

// Create Discord client with desired intents
// Include DM intents and partials so features like modmail work in DMs
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.Reaction
  ]
});

client.prefixFeatures = prefixFeatures;
client.slashFeatures = slashFeatures;
client.features = prefixFeatures;

// Allow each feature to register itself
for (const feature of Object.values(prefixFeatures)) {
  if (typeof feature.register === 'function') {
    feature.register(client, commands);
  }
}

// Allow slash features to register themselves
for (const feature of Object.values(slashFeatures)) {
  if (typeof feature.registerSlash === 'function') {
    feature.registerSlash(client);
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
