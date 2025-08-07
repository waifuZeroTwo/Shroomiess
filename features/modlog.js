const { EmbedBuilder } = require('discord.js');

function register(client, commands) {
  const channelId = process.env.MODLOG_CHANNEL_ID;
  if (!channelId) {
    console.warn('MODLOG_CHANNEL_ID is not set; moderation logging disabled.');
    return;
  }

  let modChannel = null;

  client.once('ready', async () => {
    try {
      modChannel = await client.channels.fetch(channelId);
    } catch (err) {
      console.warn('Failed to fetch mod-log channel:', err);
    }
  });

  async function sendLog(action, data = {}) {
    if (!modChannel) {
      console.warn('Mod-log channel not available; skipping log.');
      return;
    }
    try {
      const embed = new EmbedBuilder()
        .setTitle(action)
        .setColor(0xff0000)
        .setTimestamp();

      if (data.userId) embed.addFields({ name: 'User', value: `<@${data.userId}>`, inline: true });
      if (data.moderatorId) embed.addFields({ name: 'Moderator', value: `<@${data.moderatorId}>`, inline: true });
      if (data.duration) embed.addFields({ name: 'Duration', value: String(data.duration), inline: true });
      if (data.reason) embed.addFields({ name: 'Reason', value: data.reason });

      await modChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error(`Failed to send ${action} log:`, err);
    }
  }

  client.on('ban', (data) => sendLog('Ban', data));
  client.on('unban', (data) => sendLog('Unban', data));
  client.on('kick', (data) => sendLog('Kick', data));
  client.on('mute', (data) => sendLog('Mute', data));
  client.on('warn', (data) => sendLog('Warn', data));
}

module.exports = { register };
