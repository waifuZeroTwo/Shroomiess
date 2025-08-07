const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { activeTickets } = require('../prefix/modmail');

async function registerSlash(client) {
  const claim = new SlashCommandBuilder()
    .setName('claim')
    .setDescription('Claim a modmail ticket.');

  const unclaim = new SlashCommandBuilder()
    .setName('unclaim')
    .setDescription('Unclaim the current ticket.');

  const close = new SlashCommandBuilder()
    .setName('close')
    .setDescription('Close the current ticket (assigned admin only).');

  const ticketlog = new SlashCommandBuilder()
    .setName('ticketlog')
    .setDescription('Send the latest modmail log for a user.')
    .addStringOption((opt) =>
      opt.setName('userid').setDescription('User ID').setRequired(true)
    );

  if (client.commands) {
    client.commands.set('/claim', {
      description: '`/claim` - Claim a modmail ticket.',
      category: 'Modmail',
      adminOnly: true
    });
    client.commands.set('/unclaim', {
      description: '`/unclaim` - Unclaim the current ticket.',
      category: 'Modmail',
      adminOnly: true
    });
    client.commands.set('/close', {
      description: '`/close` - Close the current ticket (assigned admin only).',
      category: 'Modmail',
      adminOnly: true
    });
    client.commands.set('/ticketlog', {
      description: '`/ticketlog <userId>` - Send the latest modmail log for a user.',
      category: 'Modmail',
      adminOnly: true
    });
  }

  try {
    await client.application.commands.create(claim.toJSON());
    await client.application.commands.create(unclaim.toJSON());
    await client.application.commands.create(close.toJSON());
    await client.application.commands.create(ticketlog.toJSON());
  } catch (err) {
    console.error('Failed to register modmail slash commands:', err);
  }

  client.on('interactionCreate', async (interaction) => {
    try {
      if (!interaction.isChatInputCommand()) return;
      const { commandName } = interaction;
      if (commandName === 'ticketlog') {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) {
          return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }
        const targetId = interaction.options.getString('userid', true);
        const logsDir = path.join(__dirname, '..', '..', 'ticket_logs');
        try {
          const files = fs
            .readdirSync(logsDir)
            .filter((f) => f.startsWith(`${targetId}-`));
          if (!files.length) {
            return interaction.reply('No ticket log exists for that user.');
          }
          const latest = files
            .sort((a, b) => {
              const tsA = parseInt(a.split('-')[1], 10);
              const tsB = parseInt(b.split('-')[1], 10);
              return tsB - tsA;
            })[0];
          const filePath = path.join(logsDir, latest);
          let log;
          try {
            const raw = fs.readFileSync(filePath, 'utf8');
            log = JSON.parse(raw);
            if (!Array.isArray(log)) throw new Error('Malformed log');
          } catch (err) {
            return interaction.reply('Log file is missing or malformed.');
          }
          const lines = [];
          for (const entry of log) {
            const user = await client.users.fetch(entry.id).catch(() => null);
            const tag = user ? user.tag : 'Unknown#0000';
            const role = entry.from === 'admin' ? 'Admin' : 'User';
            lines.push(`**${role} (${tag})**: ${entry.content}`);
          }
          const chunks = [];
          let current = '';
          for (const line of lines) {
            if (current.length + line.length + 1 > 4096) {
              chunks.push(current);
              current = '';
            }
            current += (current ? '\n' : '') + line;
          }
          if (current) chunks.push(current);
          const embeds = chunks.map((c) => new EmbedBuilder().setDescription(c));
          await interaction.reply({ embeds, files: [filePath] });
        } catch (err) {
          await interaction.reply('No ticket log exists for that user.');
        }
        return;
      }

      // The rest commands operate within ticket channels
      let userId = null;
      for (const [uid, ticket] of activeTickets.entries()) {
        if (ticket.channelId === interaction.channelId) {
          userId = uid;
          break;
        }
      }
      if (!userId) return; // not in ticket channel

      const ticket = activeTickets.get(userId);
      if (commandName === 'claim') {
        if (ticket.assignedAdminId && ticket.assignedAdminId !== interaction.user.id) {
          await interaction.reply('Ticket already claimed.');
        } else if (ticket.assignedAdminId === interaction.user.id) {
          await interaction.reply('You have already claimed this ticket.');
        } else {
          ticket.assignedAdminId = interaction.user.id;
          await interaction.reply(`Ticket claimed by <@${interaction.user.id}>.`);
        }
      } else if (commandName === 'unclaim') {
        if (ticket.assignedAdminId !== interaction.user.id) {
          await interaction.reply('You are not the assigned admin.');
        } else {
          ticket.assignedAdminId = null;
          await interaction.reply('Ticket unclaimed.');
        }
      } else if (commandName === 'close') {
        if (ticket.assignedAdminId !== interaction.user.id) {
          await interaction.reply('You are not the assigned admin.');
        } else {
          const user = await client.users.fetch(userId);
          await user.send('Your ticket has been closed.');
          const logsDir = path.join(__dirname, '..', '..', 'ticket_logs');
          fs.mkdirSync(logsDir, { recursive: true });
          const filePath = path.join(logsDir, `${userId}-${Date.now()}.json`);
          await fs.promises.writeFile(filePath, JSON.stringify(ticket.log, null, 2));
          const channelId = interaction.channelId;
          await interaction.channel.delete().catch(() => null);
          activeTickets.delete(userId);
          client.emit('modmail', { action: 'Closed', userId, channelId });
        }
      }
    } catch (err) {
      console.error('Error handling modmail slash command:', err);
    }
  });
}

module.exports = { registerSlash };
