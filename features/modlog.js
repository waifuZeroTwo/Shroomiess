const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { setModLogChannel, getModLogChannel } = require('../database');

function register(client, commands) {
  commands.set(
    '!setmodlog',
    '`!setmodlog <#channel>` - Set the channel where moderation actions are logged.'
  );

  const modLogChannels = new Map();

  client.once('ready', async () => {
    try {
      for (const guild of client.guilds.cache.values()) {
        const channelId = await getModLogChannel(guild.id);
        if (channelId) {
          modLogChannels.set(guild.id, channelId);
        }
      }
    } catch (err) {
      console.warn('Failed to load mod-log channels:', err);
    }
  });

  client.on('messageCreate', async (message) => {
    try {
      if (message.author.bot) return;
      if (!message.guild) return;
      if (!message.content.startsWith('!')) return;

      const args = message.content.trim().split(/\s+/);
      const command = args.shift().toLowerCase();

      if (command === '!setmodlog') {
        if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
          return message.reply('You do not have permission to use this command.');
        }
        const channel = message.mentions.channels.first();
        if (!channel) {
          return message.reply('Please mention a channel to set as the mod-log.');
        }
        try {
          await setModLogChannel(message.guild.id, channel.id);
          modLogChannels.set(message.guild.id, channel.id);
          return message.reply(`Mod-log channel set to ${channel}.`);
        } catch (err) {
          console.error('Failed to set mod-log channel:', err);
          return message.reply('Failed to set mod-log channel.');
        }
      }
    } catch (err) {
      console.error('Error handling modlog command:', err);
    }
  });

  async function sendLog(guildId, action, data = {}) {
    const channelId = modLogChannels.get(guildId);
    if (!channelId) return;

    try {
      const channel = await client.channels.fetch(channelId);
      const embed = new EmbedBuilder()
        .setTitle(action)
        .setColor(0xff0000)
        .setTimestamp();

      if (data.userId)
        embed.addFields({ name: 'User', value: `<@${data.userId}>`, inline: true });
      if (data.moderatorId)
        embed.addFields({ name: 'Moderator', value: `<@${data.moderatorId}>`, inline: true });
      if (data.duration)
        embed.addFields({ name: 'Duration', value: String(data.duration), inline: true });
      if (data.reason) embed.addFields({ name: 'Reason', value: data.reason });

      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(`Failed to send ${action} log:`, err);
    }
  }

  client.on('ban', (data) => sendLog(data.guildId, 'Ban', data));
  client.on('unban', (data) => sendLog(data.guildId, 'Unban', data));
  client.on('kick', (data) => sendLog(data.guildId, 'Kick', data));
  client.on('mute', (data) => sendLog(data.guildId, 'Mute', data));
  client.on('warn', (data) => sendLog(data.guildId, 'Warn', data));
  client.on('modmail', (data) =>
    sendLog(data.guildId, `Modmail ${data.action}`, data)
  );
}

module.exports = { register };

