const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { addMute, removeMute } = require('../../database');
const { parseDuration } = require('../prefix/mute');

async function registerSlash(client) {
  const mute = new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Temporarily mute a user.')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to mute').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('duration').setDescription('Duration e.g. 10m, 1h').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('Reason for mute').setRequired(false)
    );

  const unmute = new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove a mute from a user.')
    .addStringOption((opt) =>
      opt.setName('userid').setDescription('ID of user to unmute').setRequired(true)
    );

  if (client.commands) {
    client.commands.set('/mute', {
      description: '`/mute <user> <duration> [reason]` - Temporarily mute a user.',
      category: 'Moderation',
      adminOnly: true
    });
    client.commands.set('/unmute', {
      description: '`/unmute <userid>` - Remove a mute from a user.',
      category: 'Moderation',
      adminOnly: true
    });
  }

  try {
    await client.application.commands.create(mute.toJSON());
    await client.application.commands.create(unmute.toJSON());
  } catch (err) {
    console.error('Failed to register mute slash commands:', err);
  }

  client.on('interactionCreate', async (interaction) => {
    try {
      if (!interaction.isChatInputCommand()) return;
      const { commandName } = interaction;
      if (commandName === 'mute') {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ModerateMembers)) {
          return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }
        const user = interaction.options.getUser('user', true);
        const durationStr = interaction.options.getString('duration', true);
        const duration = parseDuration(durationStr);
        if (!duration) {
          return interaction.reply({ content: 'Invalid duration. Use formats like `10m`, `1h`, etc.', ephemeral: true });
        }
        const reason = interaction.options.getString('reason') || 'No reason provided';
        try {
          const member = await interaction.guild.members.fetch(user.id);
          await member.timeout(duration, reason);
          await addMute({
            userId: user.id,
            guildId: interaction.guildId,
            expiresAt: new Date(Date.now() + duration)
          });
          await interaction.reply(`Muted ${user.tag} for ${durationStr}.`);
        } catch (err) {
          console.error('Mute failed:', err);
          await interaction.reply({ content: 'Failed to mute user.', ephemeral: true });
        }
      } else if (commandName === 'unmute') {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ModerateMembers)) {
          return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }
        const userId = interaction.options.getString('userid', true);
        try {
          const member = await interaction.guild.members.fetch(userId);
          await member.timeout(null);
          await removeMute(interaction.guildId, userId);
          await interaction.reply(`Unmuted <@${userId}>.`);
        } catch (err) {
          console.error('Unmute failed:', err);
          await interaction.reply({ content: 'Failed to unmute user.', ephemeral: true });
        }
      }
    } catch (err) {
      console.error('Error handling mute slash command:', err);
    }
  });
}

module.exports = { registerSlash };
