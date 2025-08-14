const {
  SlashCommandBuilder,
  PermissionsBitField
} = require('discord.js');
const CustomCommand = require('../../database/customCommands');

async function registerSlash(client) {
  const data = new SlashCommandBuilder()
    .setName('custom')
    .setDescription('Manage custom commands')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a custom command')
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('prefix or slash')
            .setRequired(true)
            .addChoices(
              { name: 'prefix', value: 'prefix' },
              { name: 'slash', value: 'slash' }
            )
        )
        .addStringOption((opt) =>
          opt.setName('name').setDescription('Command name').setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('response')
            .setDescription('Response text')
            .setRequired(true)
        )
        .addRoleOption((opt) =>
          opt
            .setName('role1')
            .setDescription('Role required')
            .setRequired(false)
        )
        .addRoleOption((opt) =>
          opt
            .setName('role2')
            .setDescription('Additional role')
            .setRequired(false)
        )
        .addRoleOption((opt) =>
          opt
            .setName('role3')
            .setDescription('Additional role')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('edit')
        .setDescription('Edit a custom command')
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('prefix or slash')
            .setRequired(true)
            .addChoices(
              { name: 'prefix', value: 'prefix' },
              { name: 'slash', value: 'slash' }
            )
        )
        .addStringOption((opt) =>
          opt.setName('name').setDescription('Command name').setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('response')
            .setDescription('Response text')
            .setRequired(true)
        )
        .addRoleOption((opt) =>
          opt
            .setName('role1')
            .setDescription('Role required')
            .setRequired(false)
        )
        .addRoleOption((opt) =>
          opt
            .setName('role2')
            .setDescription('Additional role')
            .setRequired(false)
        )
        .addRoleOption((opt) =>
          opt
            .setName('role3')
            .setDescription('Additional role')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a custom command')
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('prefix or slash')
            .setRequired(true)
            .addChoices(
              { name: 'prefix', value: 'prefix' },
              { name: 'slash', value: 'slash' }
            )
        )
        .addStringOption((opt) =>
          opt.setName('name').setDescription('Command name').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List custom commands')
    );

  if (client.commands) {
    client.commands.set('/custom', {
      description: '`/custom add|edit|remove|list` - Manage custom commands.',
      category: 'Admin',
      adminOnly: true
    });
  }

  client.on('interactionCreate', async (interaction) => {
    try {
      if (!interaction.isChatInputCommand()) return;
      if (interaction.commandName !== 'custom') return;
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({
          content: 'You do not have permission to use this command.',
          ephemeral: true
        });
      }
      const sub = interaction.options.getSubcommand();
      const guildId = interaction.guildId;
      if (sub === 'add' || sub === 'edit') {
        const type = interaction.options.getString('type');
        const name = interaction.options.getString('name');
        const response = interaction.options.getString('response');
        const roles = ['role1', 'role2', 'role3']
          .map((r) => interaction.options.getRole(r)?.id)
          .filter(Boolean);
        const placeholders = Array.from(
          new Set(response.match(/{{(.*?)}}/g)?.map((s) => s.slice(2, -2)) || [])
        );
        const data = {
          guildId,
          type,
          name: name.toLowerCase(),
          response,
          roles,
          placeholders
        };
        await CustomCommand.findOneAndUpdate(
          { guildId, name: data.name, type },
          data,
          { upsert: true }
        );
        if (!client.customCommandsCache.has(guildId)) {
          client.customCommandsCache.set(guildId, { prefix: new Map(), slash: new Map() });
        }
        const cache = client.customCommandsCache.get(guildId);
        cache[type].set(data.name, data);
        const key = (type === 'prefix' ? '!' : '/') + data.name;
        client.commands.set(key, {
          description: `\`${key}\` - Custom command.`,
          category: 'Custom',
          adminOnly: roles.length > 0
        });
        if (type === 'slash') {
          try {
            await interaction.guild.commands.create({ name: data.name, description: 'Custom command' });
          } catch (err) {
            console.error('Failed to register slash command:', err);
          }
        }
        return interaction.reply({ content: `Custom command \`${name}\` saved.`, ephemeral: true });
      }
      if (sub === 'remove') {
        const type = interaction.options.getString('type');
        const name = interaction.options.getString('name');
        await CustomCommand.deleteOne({ guildId, type, name: name.toLowerCase() });
        const cache = client.customCommandsCache.get(guildId);
        if (cache) cache[type].delete(name.toLowerCase());
        const key = (type === 'prefix' ? '!' : '/') + name.toLowerCase();
        client.commands.delete(key);
        if (type === 'slash') {
          try {
            const cmds = await interaction.guild.commands.fetch();
            const target = cmds.find((c) => c.name === name.toLowerCase());
            if (target) await interaction.guild.commands.delete(target.id);
          } catch (err) {
            console.error('Failed to remove slash command:', err);
          }
        }
        return interaction.reply({ content: `Custom command \`${name}\` removed.`, ephemeral: true });
      }
      if (sub === 'list') {
        const cache = client.customCommandsCache.get(guildId);
        if (!cache)
          return interaction.reply({ content: 'No custom commands.', ephemeral: true });
        const prefix = [...cache.prefix.keys()].map((n) => `\`!${n}\``);
        const slash = [...cache.slash.keys()].map((n) => `\`/${n}\``);
        const lines = [];
        if (prefix.length) lines.push('Prefix: ' + prefix.join(', '));
        if (slash.length) lines.push('Slash: ' + slash.join(', '));
        return interaction.reply({ content: lines.join('\n') || 'No custom commands.', ephemeral: true });
      }
    } catch (err) {
      console.error('Error handling /custom command:', err);
    }
  });

  // only `/custom` is registered here; actual custom commands are registered in bot.js
  return [data.toJSON()];
}

module.exports = { registerSlash };
