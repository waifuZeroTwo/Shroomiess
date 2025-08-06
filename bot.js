require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Partials, PermissionsBitField } = require('discord.js');
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
  try {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    if (command === '!ping') {
      return message.reply('Pong!');
    }

    if (command === '!ban' && moderation) {
      const user = message.mentions.users.first();
      const userId = user ? user.id : args[0];
      if (!userId) return message.reply('Provide a user mention or ID to ban.');
      const reason = args.slice(1).join(' ') || 'No reason provided';
      try {
        await moderation.banUser(client, message.guild.id, userId, reason);
        return message.reply(`Banned ${user ? user.tag : userId}`);
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

    if (command === '!banexplain' && moderation) {
      if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply('This command is restricted to administrators.');
      }
      try {
        await moderation.explainBanQuery(client, message);
      } catch (err) {
        console.error('Explain failed:', err);
        return message.reply('Failed to retrieve query stats.');
      }
    }
  } catch (err) {
    console.error('Error handling message:', err);
    try {
      await message.reply('An error occurred while processing your command.');
    } catch (replyErr) {
      console.error('Failed to send error reply:', replyErr);
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
