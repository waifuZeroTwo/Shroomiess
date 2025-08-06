const { addBan, removeBan, getBanCollection } = require('../database');

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

module.exports = { banUser, unbanUser, explainBanQuery };
