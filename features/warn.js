const { addWarning, listWarnings } = require('../database');

function register(client, commands) {
  commands.set('!warn', {
    description: '`!warn <@user|userId> [reason]` - Log a warning for a user.',
    category: 'Moderation',
    adminOnly: true
  });
  commands.set('!warnings', {
    description: '`!warnings <userId>` - List warnings for a user.',
    category: 'Moderation',
    adminOnly: true
  });

  client.on('messageCreate', async (message) => {
    try {
      if (message.author.bot) return;
      if (!message.content.startsWith('!')) return;
      if (!message.guild) return;

      const args = message.content.trim().split(/\s+/);
      const command = args.shift().toLowerCase();

      if (command === '!warn') {
        const user = message.mentions.users.first();
        const userId = user ? user.id : args.shift();
        if (!userId) return message.reply('Provide a user mention or ID to warn.');
        const reason = args.join(' ') || 'No reason provided';
        await addWarning({ guildId: message.guild.id, userId, reason });
        await message.reply(`Warning recorded for <@${userId}>: ${reason}`);
        try {
          const warnings = await listWarnings(message.guild.id, userId);
          if (warnings.length >= 3) {
            const member = await message.guild.members.fetch(userId);
            await member.timeout(10 * 60 * 1000, 'Auto-mute after 3 warnings');
            await message.channel.send(`Auto-muted <@${userId}> for repeated warnings.`);
          }
        } catch (err) {
          console.error('Failed to check warnings:', err);
        }
      }

      if (command === '!warnings') {
        const userId = args[0];
        if (!userId) return message.reply('Provide a user ID to view warnings.');
        const warnings = await listWarnings(message.guild.id, userId);
        if (!warnings.length) {
          return message.reply('No warnings found for that user.');
        }
        const lines = warnings.map((w, i) => `${i + 1}. ${w.reason} - ${w.createdAt.toISOString()}`);
        return message.channel.send(`Warnings for <@${userId}>:\n${lines.join('\n')}`);
      }
    } catch (err) {
      console.error('Error handling warning command:', err);
    }
  });
}

module.exports = { register };
