require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  PermissionsBitField
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const db = require('./database');
const CustomCommand = require('./database/customCommands');

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
const customCommandsCache = new Map();

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

// Increase the default maximum number of listeners for shared events.
// This avoids Node's memory leak warnings when multiple features attach
// `messageCreate` handlers during startup.
client.setMaxListeners(20);

client.prefixFeatures = prefixFeatures;
client.slashFeatures = slashFeatures;
client.features = prefixFeatures;
client.commands = commands;
client.customCommandsCache = customCommandsCache;

// Allow each feature to register itself
for (const feature of Object.values(prefixFeatures)) {
  if (typeof feature.register === 'function') {
    feature.register(client, commands);
  }
}

function hasRequiredRoles(member, roles = []) {
  if (!roles.length) return true;
  return roles.some((id) => member.roles.cache.has(id));
}

function applyPlaceholders(text, { message, interaction }) {
  return text.replace(/{{(user|channel|guild)}}/g, (_, token) => {
    switch (token) {
      case 'user':
        return message ? message.author.toString() : interaction.user.toString();
      case 'channel':
        return message
          ? message.channel.toString()
          : interaction.channel.toString();
      case 'guild':
        return message ? message.guild.name : interaction.guild.name;
      default:
        return '';
    }
  });
}

async function loadCustomCommands() {
  const docs = await CustomCommand.find({});
  for (const doc of docs) {
    const key = doc.type === 'prefix' ? '!' : '/';
    if (!customCommandsCache.has(doc.guildId)) {
      customCommandsCache.set(doc.guildId, {
        prefix: new Map(),
        slash: new Map()
      });
    }
    const guildCache = customCommandsCache.get(doc.guildId);
    guildCache[doc.type].set(doc.name, doc);
    commands.set(`${key}${doc.name}`, {
      description: `\`${key}${doc.name}\` - Custom command.`,
      category: 'Custom',
      adminOnly: doc.roles && doc.roles.length > 0
    });
  }
}

client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith('!')) return;
    const name = message.content.slice(1).trim().split(/\s+/)[0].toLowerCase();
    const cache = customCommandsCache.get(message.guild.id);
    if (!cache || !cache.prefix.has(name)) return;
    const cmd = cache.prefix.get(name);
    if (!hasRequiredRoles(message.member, cmd.roles)) return;
    const response = applyPlaceholders(cmd.response, { message });
    await message.reply(response);
  } catch (err) {
    console.error('Error executing custom prefix command:', err);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;
    const cache = customCommandsCache.get(interaction.guildId);
    if (!cache || !cache.slash.has(interaction.commandName)) return;
    const cmd = cache.slash.get(interaction.commandName);
    if (!hasRequiredRoles(interaction.member, cmd.roles)) {
      return interaction.reply({
        content: 'You do not have permission to use this command.',
        ephemeral: true
      });
    }
    const response = applyPlaceholders(cmd.response, { interaction });
    await interaction.reply(response);
  } catch (err) {
    console.error('Error executing custom slash command:', err);
  }
});
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
  const payloads = [];

  for (const feature of Object.values(slashFeatures)) {
    if (typeof feature.registerSlash === 'function') {
      try {
        const cmds = await feature.registerSlash(client);
        if (Array.isArray(cmds)) payloads.push(...cmds);
      } catch (err) {
        console.error('Failed to register slash feature:', err);
      }
    }
  }

  const guildId = process.env.GUILD_ID;
  try {
    if (process.env.NODE_ENV === 'production') {
      await rest.put(Routes.applicationCommands(client.user.id), { body: payloads });
      console.log('Registered global slash commands');
    } else {
      const guildIds = guildId ? [guildId] : client.guilds.cache.map(g => g.id);
      for (const id of guildIds) {
        await rest.put(
          Routes.applicationGuildCommands(client.user.id, id),
          { body: payloads }
        );
        console.log(`Registered guild slash commands for ${id}`);
      }
    }
  } catch (err) {
    console.error('Failed to register application commands:', err);
  }

  // Register existing custom slash commands for their guilds
  for (const [gid, cache] of customCommandsCache.entries()) {
    const guild = client.guilds.cache.get(gid);
    if (!guild) continue;
    for (const [name] of cache.slash) {
      try {
        await guild.commands.create({ name, description: 'Custom command' });
      } catch (err) {
        console.error('Failed to register custom slash command:', err);
      }
    }
  }
});

async function start() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    throw new Error('DISCORD_BOT_TOKEN is not defined in environment variables.');
  }

  try {
    await db.init();
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_DB
    });
    await loadCustomCommands();
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
