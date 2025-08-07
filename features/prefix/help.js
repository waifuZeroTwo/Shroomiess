const { EmbedBuilder } = require('discord.js');

function register(client, commands) {
  commands.set('!help', {
    description: '`!help` - Show available commands.',
    category: 'General',
    adminOnly: false
  });

  client.on('messageCreate', async (message) => {
    try {
      if (message.author.bot) return;
      if (!message.content.startsWith('!')) return;

      const args = message.content.trim().split(/\s+/);
      const command = args.shift().toLowerCase();

      if (command === '!help') {
        const categoryEmojis = {
          General: '💬',
          Birthdays: '🎂',
          Modmail: '📬',
          Moderation: '🛡️'
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
          let embed = new EmbedBuilder()
            .setTitle('Available Commands')
            .setColor(randomColor());
          let fieldCount = 0;
          const addField = (name, value) => {
            if (fieldCount === 25) {
              embeds.push(embed);
              embed = new EmbedBuilder()
                .setTitle('Available Commands')
                .setColor(randomColor());
              fieldCount = 0;
            }
            embed.addFields({ name, value });
            fieldCount++;
          };
          for (const [cat, lines] of userCategories) {
            const name = `${categoryEmojis[cat] ?? ''} ${cat}`.trim();
            let chunk = [];
            for (const line of lines) {
              if ([...chunk, line].join('\n').length > 1024) {
                addField(name, chunk.join('\n'));
                chunk = [];
              }
              chunk.push(line);
            }
            if (chunk.length) addField(name, chunk.join('\n'));
          }
          if (fieldCount) embeds.push(embed);
        }

        if (adminCategories.size) {
          let embed = new EmbedBuilder()
            .setTitle('ADMIN ONLY')
            .setColor(randomColor());
          let fieldCount = 0;
          const addField = (name, value) => {
            if (fieldCount === 25) {
              embeds.push(embed);
              embed = new EmbedBuilder()
                .setTitle('ADMIN ONLY')
                .setColor(randomColor());
              fieldCount = 0;
            }
            embed.addFields({ name, value });
            fieldCount++;
          };
          for (const [cat, lines] of adminCategories) {
            const name = `${categoryEmojis[cat] ?? ''} ${cat}`.trim();
            let chunk = [];
            for (const line of lines) {
              if ([...chunk, line].join('\n').length > 1024) {
                addField(name, chunk.join('\n'));
                chunk = [];
              }
              chunk.push(line);
            }
            if (chunk.length) addField(name, chunk.join('\n'));
          }
          if (fieldCount) embeds.push(embed);
        }

        try {
          await message.author.send({ embeds });
          await message.reply('📬 Check your DMs for the command list!');
        } catch (err) {
          await message.reply("❌ I couldn't send you the command list. Please enable DMs.");
        }
      }
    } catch (err) {
      console.error('Error handling help command:', err);
    }
  });
}

module.exports = { register };
