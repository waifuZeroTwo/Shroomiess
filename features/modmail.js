const { EmbedBuilder, PermissionsBitField, PermissionFlagsBits, ChannelType } = require('discord.js');

const MAIN_GUILD_ID = '1165456303209054208';

function register(client, commands) {
  client.on('messageCreate', async (message) => {
    try {
      if (message.author.bot) return;
      if (message.guild) return;

      const promptEmbed = new EmbedBuilder()
        .setTitle('Open a Modmail Ticket?')
        .setDescription('React with ✅ to confirm or 🚫 to cancel.');

      // Send prompt directly to the user to confirm opening a ticket
      const prompt = await message.author.send({ embeds: [promptEmbed] });
      await prompt.react('✅');
      await prompt.react('🚫');

      const filter = (reaction, user) =>
        user.id === message.author.id && ['✅', '🚫'].includes(reaction.emoji.name);
      const collected = await prompt.awaitReactions({ filter, max: 1, time: 60000 });
      const reaction = collected.first();

      if (!reaction || reaction.emoji.name === '🚫') {
        const cancelEmbed = new EmbedBuilder().setDescription('Modmail request cancelled.');
        await message.author.send({ embeds: [cancelEmbed] });
        client.emit('modmail', {
          guildId: MAIN_GUILD_ID,
          userId: message.author.id,
          action: 'Cancelled'
        });
        return;
      }

      const guild = await client.guilds.fetch(MAIN_GUILD_ID);
      const staffRole = guild.roles.cache.find((r) =>
        r.permissions.has(PermissionsBitField.Flags.ManageGuild)
      );

      const channel = await guild.channels.create({
        name: `modmail-${message.author.id}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          ...(staffRole
            ? [{ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel] }]
            : [])
        ]
      });

      await channel.send(
        `New modmail from <@${message.author.id}>:\n${message.content}`
      );

      const confirmEmbed = new EmbedBuilder().setDescription(
        'Your ticket has been opened. Staff will reply soon.'
      );
      await message.author.send({ embeds: [confirmEmbed] });

      client.emit('modmail', {
        guildId: MAIN_GUILD_ID,
        userId: message.author.id,
        action: 'Opened',
        channelId: channel.id
      });
    } catch (err) {
      console.error('Error handling modmail:', err);
    }
  });
}

module.exports = { register };

