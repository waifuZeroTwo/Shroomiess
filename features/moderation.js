const { addBan, removeBan } = require('../database');

/**
 * Ban a user from a guild and record it in the database.
 * @param {Client} client Discord.js client
 * @param {string} guildId ID of the guild
 * @param {string} userId ID of the user to ban
 * @param {string} reason Reason for ban
 * @param {object} [options] Additional options such as duration in ms
 */
async function banUser(client, guildId, userId, reason, options = {}) {
  const guild = await client.guilds.fetch(guildId);
  await guild.members.ban(userId, { reason, ...options });
  const expiresAt = options.duration ? new Date(Date.now() + options.duration) : null;
  await addBan({ userId, guildId, reason, expiresAt });
}

/**
 * Remove a ban from a user and database.
 * @param {Client} client Discord.js client
 * @param {string} guildId ID of the guild
 * @param {string} userId ID of the user to unban
 */
async function unbanUser(client, guildId, userId) {
  const guild = await client.guilds.fetch(guildId);
  await guild.members.unban(userId);
  await removeBan(guildId, userId);
}

module.exports = { banUser, unbanUser };
