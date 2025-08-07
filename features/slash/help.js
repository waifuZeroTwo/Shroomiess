const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

async function registerSlash(client) {
  const data = new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show available commands.');

  if (client.commands) {
    client.commands.set('/help', {
      description: '`/help` - Show available commands.',
      category: 'General',
      adminOnly: false
    });
  }

  client.on('interactionCreate', async (interaction) => {
    try {
      if (!interaction.isChatInputCommand()) return;
      if (interaction.commandName !== 'help') return;

      const commands = client.commands || new Map();
      const categoryEmojis = {
        General: '💬',
        Birthdays: '🎂',
        Modmail: '📬',
        Moderation: '🛡️',
        Reputation: '🏆'
      };

      const userCategories = new Map();
      const adminCategories = new Map();
      for (const [, info] of commands) {
        const target = info.adminOnly ? adminCategories : userCategories;
        if (!target.has(info.category)) target.set(info.category, []);
        target.get(info.category).push(info.description);
      }

      const randomColor = () => Math.floor(Math.random() * 0xffffff);
      const embeds = [];

      if (userCategories.size) {
        const embed = new EmbedBuilder()
          .setTitle('Available Commands')
          .setColor(randomColor());
        for (const [cat, lines] of userCategories) {
          const name = `${categoryEmojis[cat] ?? ''} ${cat}`.trim();
          embed.addFields({ name, value: lines.join('\n') });
        }
        embeds.push(embed);
      }

      if (adminCategories.size) {
        const embed = new EmbedBuilder()
          .setTitle('ADMIN ONLY')
          .setColor(randomColor());
        for (const [cat, lines] of adminCategories) {
          const name = `${categoryEmojis[cat] ?? ''} ${cat}`.trim();
          embed.addFields({ name, value: lines.join('\n') });
        }
        embeds.push(embed);
      }

      try {
        await interaction.user.send({ embeds });
        await interaction.reply({ content: '📬 Check your DMs for the command list!', ephemeral: true });
      } catch (err) {
        await interaction.reply({ content: "❌ I couldn't send you the command list. Please enable DMs.", ephemeral: true });
      }
    } catch (err) {
      console.error('Error handling /help command:', err);
    }
  });

  return [data.toJSON()];
}

module.exports = { registerSlash };
