require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('./database');

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
const moderation = features.moderation;

// Create Discord client with desired intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

client.commands = new Collection();
client.features = features;

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  if (moderation) {
    const bans = await db.Ban.find({ expiresAt: { $gt: new Date() } });
    for (const ban of bans) {
      try {
        const guild = await client.guilds.fetch(ban.guildId);
        await guild.members.ban(ban.userId, { reason: ban.reason });
      } catch (err) {
        console.error(`Failed to enforce ban for ${ban.userId}`, err);
      }
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith('!')) return;

  const args = message.content.trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  if (command === '!ping') {
    return message.reply('Pong!');
  }

  if (command === '!ban' && moderation) {
    const user = message.mentions.users.first();
    if (!user) return message.reply('Please mention a user to ban.');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    try {
      await moderation.banUser(client, message.guild.id, user.id, reason);
      return message.reply(`Banned ${user.tag}`);
    } catch (err) {
      console.error('Ban failed:', err);
      return message.reply('Failed to ban user.');
    }
  }

  if (command === '!unban' && moderation) {
    const userId = args[0];
    if (!userId) return message.reply('Please provide a user ID to unban.');
    try {
      await moderation.unbanUser(client, message.guild.id, userId);
      return message.reply(`Unbanned <@${userId}>`);
    } catch (err) {
      console.error('Unban failed:', err);
      return message.reply('Failed to unban user.');
    }
  }
});

async function start() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    throw new Error('DISCORD_BOT_TOKEN is not defined in environment variables.');
  }

  await db.init();

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
