const {
  EmbedBuilder,
  PermissionsBitField,
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const MAIN_GUILD_ID = '1165456303209054208';

// Track active tickets keyed by user ID
// { channelId, assignedAdminId, log }
const activeTickets = new Map();

function register(client, commands) {
  commands.set('!claim', '`!claim` - Claim a modmail ticket.');
  commands.set('!unclaim', '`!unclaim` - Unclaim the current ticket.');
  commands.set('!close', '`!close` - Close the current ticket (assigned admin only).');
  commands.set(
    '!ticketlog',
    '`!ticketlog <userId>` - Send the latest modmail log for a user.'
  );

  // DM listener - open tickets and forward user messages
  client.on('messageCreate', async (message) => {
    try {
      if (message.author.bot) return;
      if (message.guild) return;

      const ticket = activeTickets.get(message.author.id);
      if (ticket) {
        const channel = await client.channels
          .fetch(ticket.channelId)
          .catch(() => null);
        if (channel) {
          const embed = new EmbedBuilder()
            .setAuthor({
              name: message.author.tag,
              iconURL: message.author.displayAvatarURL()
            })
            .setDescription(message.content)
            .setTimestamp();
          await channel.send({ embeds: [embed] });
          ticket.log.push({
            from: 'user',
            id: message.author.id,
            content: message.content,
            timestamp: Date.now()
          });
        }
        return;
      }

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

      const firstEmbed = new EmbedBuilder()
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL()
        })
        .setDescription(message.content)
        .setTimestamp();
      await channel.send({
        content: `New modmail from <@${message.author.id}>:`,
        embeds: [firstEmbed]
      });

      const confirmEmbed = new EmbedBuilder().setDescription(
        'Your ticket has been opened. Staff will reply soon.'
      );
      await message.author.send({ embeds: [confirmEmbed] });

      activeTickets.set(message.author.id, {
        channelId: channel.id,
        assignedAdminId: null,
        log: [
          {
            from: 'user',
            id: message.author.id,
            content: message.content,
            timestamp: Date.now()
          }
        ]
      });

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

  // Guild command listener - fetch ticket logs
  client.on('messageCreate', async (message) => {
    try {
      if (message.author.bot) return;
      if (!message.guild) return;
      if (!message.content.startsWith('!')) return;

      const args = message.content.trim().split(/\s+/);
      const command = args.shift().toLowerCase();

      if (command === '!ticketlog') {
        if (
          !message.member?.permissions.has(
            PermissionsBitField.Flags.ManageGuild
          )
        ) {
          return message.reply('You do not have permission to use this command.');
        }

        const targetId = args.shift();
        if (!targetId) {
          return message.reply('Provide a user ID to fetch logs for.');
        }

        const logsDir = path.join(__dirname, '..', 'ticket_logs');
        try {
          const files = fs
            .readdirSync(logsDir)
            .filter((f) => f.startsWith(`${targetId}-`));
          if (!files.length) {
            return message.reply('No ticket log exists for that user.');
          }

          const latest = files.sort((a, b) => {
            const tsA = parseInt(a.split('-')[1], 10);
            const tsB = parseInt(b.split('-')[1], 10);
            return tsB - tsA;
          })[0];
          const filePath = path.join(logsDir, latest);
          await message.channel.send({ files: [filePath] });
        } catch (err) {
          return message.reply('No ticket log exists for that user.');
        }
      }
    } catch (err) {
      console.error('Error handling ticket log command:', err);
    }
  });

  // Guild listener - forward assigned admin messages and handle claiming
  client.on('messageCreate', async (message) => {
    try {
      if (message.author.bot) return;
      if (!message.guild) return;
      if (message.content.trim().toLowerCase().startsWith('!ticketlog')) return;

      let userId = null;
      for (const [uid, ticket] of activeTickets.entries()) {
        if (ticket.channelId === message.channel.id) {
          userId = uid;
          break;
        }
      }
      if (!userId) return;

      const ticket = activeTickets.get(userId);
      const content = message.content.trim().toLowerCase();

      if (content === '!claim') {
        if (ticket.assignedAdminId && ticket.assignedAdminId !== message.author.id) {
          await message.reply('Ticket already claimed.');
        } else if (ticket.assignedAdminId === message.author.id) {
          await message.reply('You have already claimed this ticket.');
        } else {
          ticket.assignedAdminId = message.author.id;
          await message.reply(`Ticket claimed by <@${message.author.id}>.`);
        }
        return;
      }

      if (content === '!unclaim') {
          if (ticket.assignedAdminId !== message.author.id) {
            await message.reply('You are not the assigned admin.');
          } else {
            ticket.assignedAdminId = null;
            await message.reply('Ticket unclaimed.');
          }
          return;
      }

      if (content === '!close') {
        if (ticket.assignedAdminId !== message.author.id) {
          await message.reply('You are not the assigned admin.');
        } else {
          const user = await client.users.fetch(userId);
          await user.send('Your ticket has been closed.');
          const logsDir = path.join(__dirname, '..', 'ticket_logs');
          fs.mkdirSync(logsDir, { recursive: true });
          const filePath = path.join(logsDir, `${userId}-${Date.now()}.json`);
          await fs.promises.writeFile(
            filePath,
            JSON.stringify(ticket.log, null, 2)
          );
          const channelId = message.channel.id;
          await message.channel.delete().catch(() => null);
          activeTickets.delete(userId);
          client.emit('modmail', {
            action: 'Closed',
            userId,
            channelId
          });
        }
        return;
      }

      if (ticket.assignedAdminId === message.author.id) {
        const user = await client.users.fetch(userId);
        const embed = new EmbedBuilder()
          .setAuthor({
            name: message.author.tag,
            iconURL: message.author.displayAvatarURL()
          })
          .setDescription(message.content)
          .setTimestamp();
        await user.send({ embeds: [embed] });
        ticket.log.push({
          from: 'admin',
          id: message.author.id,
          content: message.content,
          timestamp: Date.now()
        });
      }
    } catch (err) {
      console.error('Error relaying modmail message:', err);
    }
  });
}

module.exports = { register };

