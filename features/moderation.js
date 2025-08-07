const { addBan, removeBan, getBanCollection } = require('../database');
const { PermissionsBitField } = require('discord.js');

/**
 * Ban a user from a guild and record it in the database.
 * @param {Client} client Discord.js client
 * @param {string} guildId ID of the guild
 * @param {string} userId ID of the user to ban
 * @param {string} reason Reason for ban
 * @param {object} [options] Additional options such as duration in ms
 */
async function banUser(client, guildId, userId, reason, options = {}) {
  try {
    const guild = await client.guilds.fetch(guildId);
    await guild.members.ban(userId, { reason, ...options });
    const expiresAt = options.duration ? new Date(Date.now() + options.duration) : null;
    await addBan({ userId, guildId, reason, expiresAt });
  } catch (err) {
    console.error(`Error banning user ${userId} in guild ${guildId}:`, err);
    throw err;
  }
}

/**
 * Remove a ban from a user and database.
 * @param {Client} client Discord.js client
 * @param {string} guildId ID of the guild
 * @param {string} userId ID of the user to unban
 */
async function unbanUser(client, guildId, userId) {
  try {
    const guild = await client.guilds.fetch(guildId);
    await guild.members.unban(userId);
    await removeBan(guildId, userId);
  } catch (err) {
    console.error(`Error unbanning user ${userId} in guild ${guildId}:`, err);
    throw err;
  }
}

/**
 * Explain query execution for the Ban collection.
 * Useful for diagnosing MongoDB indexing issues.
 * @param {Client} client Discord.js client (unused but kept for parity)
 * @param {Message} message Discord.js message to respond to
 */
async function explainBanQuery(client, message) {
  try {
    const banCollection = getBanCollection();
    const stats = await banCollection.find().explain('executionStats');
    const json = JSON.stringify(stats, null, 2);
    if (message && message.channel) {
      // Discord has a 2000 character limit per message
      const output = json.length > 1900 ? json.slice(0, 1900) + '\n... (truncated)' : json;
      await message.channel.send(`\`\`\`json\n${output}\n\`\`\``);
    } else {
      console.log(json);
    }
  } catch (err) {
    console.error('Failed to explain Ban query:', err);
    if (message && message.channel) {
      await message.channel.send('Failed to retrieve query stats.');
    }
  }
}

function register(client, commands) {
  commands.set('!ban', '`!ban <@user|userId> [reason]` - Ban a user and record the reason.');
  commands.set('!unban', '`!unban <userId>` - Remove a ban and unban the user.');
  commands.set('!banexplain', '`!banexplain` - *Admin only.* Show MongoDB query stats for the ban collection.');

  client.on('messageCreate', async (message) => {
    try {
      if (message.author.bot) return;
      if (!message.content.startsWith('!')) return;

      const args = message.content.trim().split(/\s+/);
      const command = args.shift().toLowerCase();

      if (command === '!ban') {
        const user = message.mentions.users.first();
        const userId = user ? user.id : args[0];
        if (!userId) return message.reply('Provide a user mention or ID to ban.');
        const reason = args.slice(1).join(' ') || 'No reason provided';
        try {
          await banUser(client, message.guild.id, userId, reason);
          return message.reply(`Banned ${user ? user.tag : userId}`);
        } catch (err) {
          console.error('Ban failed:', err);
          return message.reply('Failed to ban user.');
        }
      }

      if (command === '!unban') {
        const userId = args[0];
        if (!userId) return message.reply('Please provide a user ID to unban.');
        try {
          await unbanUser(client, message.guild.id, userId);
          return message.reply(`Unbanned <@${userId}>`);
        } catch (err) {
          console.error('Unban failed:', err);
          return message.reply('Failed to unban user.');
        }
      }

      if (command === '!banexplain') {
        if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
          return message.reply('This command is restricted to administrators.');
        }
        try {
          await explainBanQuery(client, message);
        } catch (err) {
          console.error('Explain failed:', err);
          return message.reply('Failed to retrieve query stats.');
        }
      }
    } catch (err) {
      console.error('Error handling moderation command:', err);
      try {
        await message.reply('An error occurred while processing your command.');
      } catch (replyErr) {
        console.error('Failed to send error reply:', replyErr);
      }
    }
  });
}

module.exports = { register, banUser, unbanUser, explainBanQuery };
