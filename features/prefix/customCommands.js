const { PermissionsBitField } = require('discord.js');
const CustomCommand = require('../../database/customCommands');

function register(client, commands) {
  commands.set('!custom', {
    description: '`!custom add|edit|remove|list` - Manage custom commands.',
    category: 'Admin',
    adminOnly: true
  });

  client.on('messageCreate', async (message) => {
    try {
      if (message.author.bot) return;
      if (!message.content.startsWith('!custom')) return;
      if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply('You do not have permission to use this command.');
      }

      const args = message.content.trim().split(/\s+/).slice(1);
      const sub = args.shift()?.toLowerCase();
      const guildId = message.guild.id;

      if (sub === 'add' || sub === 'edit') {
        const type = args.shift();
        const name = args.shift();
        const response = args.join(' ').replace(/<@&\d+>/g, '').trim();
        if (!type || !['prefix', 'slash'].includes(type) || !name || !response) {
          return message.reply('Usage: `!custom add|edit <prefix|slash> <name> <response> [@roles]`');
        }
        const roles = [...message.mentions.roles.keys()];
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
            await message.guild.commands.create({ name: data.name, description: 'Custom command' });
          } catch (err) {
            console.error('Failed to register slash command:', err);
          }
        }
        return message.reply(`Custom command \`${name}\` saved.`);
      }

      if (sub === 'remove') {
        const type = args.shift();
        const name = args.shift();
        if (!type || !['prefix', 'slash'].includes(type) || !name) {
          return message.reply('Usage: `!custom remove <prefix|slash> <name>`');
        }
        await CustomCommand.deleteOne({ guildId, type, name: name.toLowerCase() });
        const cache = client.customCommandsCache.get(guildId);
        if (cache) cache[type].delete(name.toLowerCase());
        const key = (type === 'prefix' ? '!' : '/') + name.toLowerCase();
        client.commands.delete(key);
        if (type === 'slash') {
          try {
            const cmd = await message.guild.commands.fetch();
            const target = cmd.find((c) => c.name === name.toLowerCase());
            if (target) await message.guild.commands.delete(target.id);
          } catch (err) {
            console.error('Failed to remove slash command:', err);
          }
        }
        return message.reply(`Custom command \`${name}\` removed.`);
      }

      if (sub === 'list') {
        const cache = client.customCommandsCache.get(guildId);
        if (!cache) return message.reply('No custom commands.');
        const prefix = [...cache.prefix.keys()].map((n) => `\`!${n}\``);
        const slash = [...cache.slash.keys()].map((n) => `\`/${n}\``);
        const lines = [];
        if (prefix.length) lines.push('Prefix: ' + prefix.join(', '));
        if (slash.length) lines.push('Slash: ' + slash.join(', '));
        return message.reply(lines.join('\n') || 'No custom commands.');
      }

      return message.reply('Usage: `!custom add|edit|remove|list`');
    } catch (err) {
      console.error('Error handling custom command admin:', err);
    }
  });
}

module.exports = { register };
