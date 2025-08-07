const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { banUser, unbanUser, explainBanQuery } = require('../prefix/moderation');

async function registerSlash(client) {
  const ban = new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user and record the reason.')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to ban').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('Reason for ban').setRequired(false)
    );

  const kick = new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the guild.')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to kick').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('Reason for kick').setRequired(false)
    );

  const unban = new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Remove a ban from a user.')
    .addStringOption((opt) =>
      opt.setName('userid').setDescription('ID of user to unban').setRequired(true)
    );

  const banexplain = new SlashCommandBuilder()
    .setName('banexplain')
    .setDescription('Show MongoDB query stats for the ban collection.');

  if (client.commands) {
    client.commands.set('/ban', {
      description: '`/ban <user> [reason]` - Ban a user and record the reason.',
      category: 'Moderation',
      adminOnly: true
    });
    client.commands.set('/kick', {
      description: '`/kick <user> [reason]` - Kick a user from the guild.',
      category: 'Moderation',
      adminOnly: true
    });
    client.commands.set('/unban', {
      description: '`/unban <userid>` - Remove a ban and unban the user.',
      category: 'Moderation',
      adminOnly: true
    });
    client.commands.set('/banexplain', {
      description:
        '`/banexplain` - *Admin only.* Show MongoDB query stats for the ban collection.',
      category: 'Moderation',
      adminOnly: true
    });
  }

  try {
    await client.application.commands.create(ban.toJSON());
    await client.application.commands.create(kick.toJSON());
    await client.application.commands.create(unban.toJSON());
    await client.application.commands.create(banexplain.toJSON());
  } catch (err) {
    console.error('Failed to register moderation slash commands:', err);
  }

  client.on('interactionCreate', async (interaction) => {
    try {
      if (!interaction.isChatInputCommand()) return;
      const { commandName } = interaction;
      if (commandName === 'ban') {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.BanMembers)) {
          return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || 'No reason provided';
        try {
          await banUser(client, interaction.guildId, user.id, reason);
          await interaction.reply(`Banned ${user.tag}`);
        } catch (err) {
          console.error('Ban failed:', err);
          await interaction.reply({ content: 'Failed to ban user.', ephemeral: true });
        }
      } else if (commandName === 'kick') {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.KickMembers)) {
          return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || 'No reason provided';
        try {
          await interaction.guild.members.kick(user.id, reason);
          await interaction.reply(`Kicked ${user.tag}`);
        } catch (err) {
          console.error('Kick failed:', err);
          await interaction.reply({ content: 'Failed to kick user.', ephemeral: true });
        }
      } else if (commandName === 'unban') {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.BanMembers)) {
          return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }
        const userId = interaction.options.getString('userid', true);
        try {
          await unbanUser(client, interaction.guildId, userId);
          await interaction.reply(`Unbanned <@${userId}>`);
        } catch (err) {
          console.error('Unban failed:', err);
          await interaction.reply({ content: 'Failed to unban user.', ephemeral: true });
        }
      } else if (commandName === 'banexplain') {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.Administrator)) {
          return interaction.reply({ content: 'This command is restricted to administrators.', ephemeral: true });
        }
        await explainBanQuery(client, {
          channel: { send: (msg) => interaction.reply(msg) }
        });
      }
    } catch (err) {
      console.error('Error handling moderation slash command:', err);
    }
  });
}

module.exports = { registerSlash };
