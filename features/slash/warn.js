const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { addWarning, listWarnings } = require('../../database');

async function registerSlash(client) {
  const warn = new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Log a warning for a user.')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to warn').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('Reason for warning').setRequired(false)
    );

  const warnings = new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('List warnings for a user.')
    .addStringOption((opt) =>
      opt.setName('userid').setDescription('ID of user to check').setRequired(true)
    );

  if (client.commands) {
    client.commands.set('/warn', {
      description: '`/warn <user> [reason]` - Log a warning for a user.',
      category: 'Moderation',
      adminOnly: true
    });
    client.commands.set('/warnings', {
      description: '`/warnings <userid>` - List warnings for a user.',
      category: 'Moderation',
      adminOnly: true
    });
  }

  try {
    await client.application.commands.create(warn.toJSON());
    await client.application.commands.create(warnings.toJSON());
  } catch (err) {
    console.error('Failed to register warn slash commands:', err);
  }

  client.on('interactionCreate', async (interaction) => {
    try {
      if (!interaction.isChatInputCommand()) return;
      const { commandName } = interaction;
      if (commandName === 'warn') {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ModerateMembers)) {
          return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || 'No reason provided';
        await addWarning({ guildId: interaction.guildId, userId: user.id, reason });
        await interaction.reply(`Warning recorded for ${user}: ${reason}`);
        try {
          const warnings = await listWarnings(interaction.guildId, user.id);
          if (warnings.length >= 3) {
            const member = await interaction.guild.members.fetch(user.id);
            await member.timeout(10 * 60 * 1000, 'Auto-mute after 3 warnings');
            await interaction.followUp({ content: `Auto-muted ${user} for repeated warnings.` });
          }
        } catch (err) {
          console.error('Failed to check warnings:', err);
        }
      } else if (commandName === 'warnings') {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ModerateMembers)) {
          return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }
        const userId = interaction.options.getString('userid', true);
        const warnings = await listWarnings(interaction.guildId, userId);
        if (!warnings.length) {
          return interaction.reply('No warnings found for that user.');
        }
        const lines = warnings.map((w, i) => `${i + 1}. ${w.reason} - ${w.createdAt.toISOString()}`);
        await interaction.reply(`Warnings for <@${userId}>:\n${lines.join('\n')}`);
      }
    } catch (err) {
      console.error('Error handling warn slash command:', err);
    }
  });
}

module.exports = { registerSlash };
