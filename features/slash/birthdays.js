const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const {
  setBirthday,
  clearBirthday,
  listBirthdays,
  setBirthdayChannel,
  setBirthdayRole,
  setBirthdayFormat,
  getBirthdayFormat
} = require('../../database');
const {
  formatDate,
  parseDate,
  DATE_FORMATS
} = require('../prefix/birthdays');

async function registerSlash(client) {
  const setBirthdayCmd = new SlashCommandBuilder()
    .setName('setbirthday')
    .setDescription("Store your birthday using the server's format.")
    .addStringOption((opt) =>
      opt.setName('date').setDescription('Date of your birthday').setRequired(true)
    );

  const clearBirthdayCmd = new SlashCommandBuilder()
    .setName('clearbirthday')
    .setDescription('Remove your birthday.');

  const listCmd = new SlashCommandBuilder()
    .setName('birthdays')
    .setDescription('List upcoming birthdays.');

  const channelCmd = new SlashCommandBuilder()
    .setName('setbirthdaychannel')
    .setDescription('Set channel for birthday messages (ManageGuild).')
    .addChannelOption((opt) =>
      opt.setName('channel').setDescription('Channel').setRequired(true)
    );

  const roleCmd = new SlashCommandBuilder()
    .setName('setbirthdayrole')
    .setDescription('Set role assigned on birthdays (ManageGuild).')
    .addRoleOption((opt) =>
      opt.setName('role').setDescription('Role').setRequired(true)
    );

  const formatCmd = new SlashCommandBuilder()
    .setName('setbirthdayformat')
    .setDescription('Set birthday date format.')
    .addStringOption((opt) =>
      opt
        .setName('format')
        .setDescription(`Format (${DATE_FORMATS.join(', ')})`)
        .setRequired(true)
    );

  if (client.commands) {
    client.commands.set('/setbirthday', {
      description: '`/setbirthday <date>` - store your birthday using the server\'s format.',
      category: 'Birthdays',
      adminOnly: false
    });
    client.commands.set('/clearbirthday', {
      description: '`/clearbirthday` - remove your birthday.',
      category: 'Birthdays',
      adminOnly: false
    });
    client.commands.set('/birthdays', {
      description: '`/birthdays` - list upcoming birthdays.',
      category: 'Birthdays',
      adminOnly: false
    });
    client.commands.set('/setbirthdaychannel', {
      description: '`/setbirthdaychannel <#channel>` - set channel for birthday messages (ManageGuild).',
      category: 'Birthdays',
      adminOnly: true
    });
    client.commands.set('/setbirthdayrole', {
      description: '`/setbirthdayrole <@role>` - set role assigned on birthdays (ManageGuild).',
      category: 'Birthdays',
      adminOnly: true
    });
    client.commands.set('/setbirthdayformat', {
      description: `\`/setbirthdayformat <format>\` - set birthday date format. Formats: ${DATE_FORMATS.join(', ')} (ManageGuild).`,
      category: 'Birthdays',
      adminOnly: true
    });
  }

  client.on('interactionCreate', async (interaction) => {
    try {
      if (!interaction.isChatInputCommand()) return;
      const { commandName } = interaction;
      const format = await getBirthdayFormat(interaction.guildId);
      if (commandName === 'setbirthday') {
        const dateStr = interaction.options.getString('date', true);
        const parsed = parseDate(dateStr, format || 'YYYY-MM-DD');
        if (!parsed) {
          return interaction.reply({
            content: `Invalid date format. Expected ${format || 'YYYY-MM-DD'}.`,
            ephemeral: true
          });
        }
        await setBirthday(interaction.guildId, interaction.user.id, parsed);
        await interaction.reply({ content: 'Birthday saved!', ephemeral: true });
      } else if (commandName === 'clearbirthday') {
        await clearBirthday(interaction.guildId, interaction.user.id);
        await interaction.reply({ content: 'Birthday cleared.', ephemeral: true });
      } else if (commandName === 'birthdays') {
        const birthdays = await listBirthdays(interaction.guildId);
        if (!birthdays.length) {
          return interaction.reply('No birthdays recorded.');
        }
        const format = await getBirthdayFormat(interaction.guildId);
        const months = Array.from({ length: 12 }, () => []);
        for (const b of birthdays) {
          const [year, month, day] = b.date.split('-').map(Number);
          months[month - 1].push({ date: b.date, day, userId: b.userId });
        }
        const monthNames = [
          'January',
          'February',
          'March',
          'April',
          'May',
          'June',
          'July',
          'August',
          'September',
          'October',
          'November',
          'December'
        ];
        const lines = [];
        for (let i = 0; i < months.length; i++) {
          const arr = months[i].sort((a, b) => a.day - b.day);
          if (!arr.length) continue;
          lines.push(`**${monthNames[i]}**`);
          for (const item of arr) {
            lines.push(`${formatDate(item.date, format)} - <@${item.userId}>`);
          }
        }
        await interaction.reply(lines.join('\n'));
      } else if (commandName === 'setbirthdaychannel') {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) {
          return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }
        const channel = interaction.options.getChannel('channel', true);
        await setBirthdayChannel(interaction.guildId, channel.id);
        await interaction.reply(`Birthday channel set to ${channel}.`);
      } else if (commandName === 'setbirthdayrole') {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) {
          return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }
        const role = interaction.options.getRole('role', true);
        await setBirthdayRole(interaction.guildId, role.id);
        await interaction.reply(`Birthday role set to ${role}.`);
      } else if (commandName === 'setbirthdayformat') {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) {
          return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }
        const fmt = interaction.options.getString('format', true);
        if (!DATE_FORMATS.includes(fmt)) {
          return interaction.reply({
            content: `Format must be one of: ${DATE_FORMATS.join(', ')}`,
            ephemeral: true
          });
        }
        await setBirthdayFormat(interaction.guildId, fmt);
        await interaction.reply(`Birthday format set to ${fmt}.`);
      }
    } catch (err) {
      console.error('Error handling birthday slash command:', err);
    }
  });

  return [
    setBirthdayCmd.toJSON(),
    clearBirthdayCmd.toJSON(),
    listCmd.toJSON(),
    channelCmd.toJSON(),
    roleCmd.toJSON(),
    formatCmd.toJSON()
  ];
}

module.exports = { registerSlash };
