const { addMute, removeMute, getActiveMutes } = require('../database');

function parseDuration(str) {
  const match = /^\s*(\d+)([smhd])?$/i.exec(str);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2] ? match[2].toLowerCase() : 'm';
  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

function register(client, commands) {
  commands.set('!mute', '`!mute <@user|userId> <duration> [reason]` - Temporarily mute a user.');
  commands.set('!unmute', '`!unmute <userId>` - Remove a mute from a user.');

  client.on('messageCreate', async (message) => {
    try {
      if (message.author.bot) return;
      if (!message.content.startsWith('!')) return;
      if (!message.guild) return;

      const args = message.content.trim().split(/\s+/);
      const command = args.shift().toLowerCase();

      if (command === '!mute') {
        const user = message.mentions.users.first();
        const userId = user ? user.id : args.shift();
        const durationStr = args.shift();
        if (!userId || !durationStr) {
          return message.reply('Usage: `!mute <@user|userId> <duration> [reason]`');
        }
        const duration = parseDuration(durationStr);
        if (!duration) {
          return message.reply('Invalid duration. Use formats like `10m`, `1h`, etc.');
        }
        const reason = args.join(' ') || 'No reason provided';
        try {
          const member = await message.guild.members.fetch(userId);
          await member.timeout(duration, reason);
          await addMute({
            userId,
            guildId: message.guild.id,
            expiresAt: new Date(Date.now() + duration)
          });
          return message.reply(`Muted <@${userId}> for ${durationStr}.`);
        } catch (err) {
          console.error('Mute failed:', err);
          return message.reply('Failed to mute user.');
        }
      }

      if (command === '!unmute') {
        const userId = args.shift();
        if (!userId) {
          return message.reply('Provide a user ID to unmute.');
        }
        try {
          const member = await message.guild.members.fetch(userId);
          await member.timeout(null);
          await removeMute(message.guild.id, userId);
          return message.reply(`Unmuted <@${userId}>.`);
        } catch (err) {
          console.error('Unmute failed:', err);
          return message.reply('Failed to unmute user.');
        }
      }
    } catch (err) {
      console.error('Error handling mute command:', err);
    }
  });

  client.on('ready', async () => {
    try {
      const mutes = await getActiveMutes();
      for (const mute of mutes) {
        try {
          const guild = await client.guilds.fetch(mute.guildId);
          const member = await guild.members.fetch(mute.userId);
          const remaining = new Date(mute.expiresAt).getTime() - Date.now();
          if (remaining > 0) {
            await member.timeout(remaining, 'Re-applying mute');
          } else {
            await removeMute(mute.guildId, mute.userId);
          }
        } catch (err) {
          console.error(`Failed to reapply mute for ${mute.userId}`, err);
        }
      }
    } catch (err) {
      console.warn('Database unavailable; skipping mute enforcement.', err);
    }
  });
}

module.exports = { register };
