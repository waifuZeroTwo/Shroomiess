const { SlashCommandBuilder } = require('discord.js');

async function registerSlash(client) {
  const data = new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot responsiveness.');

  if (client.commands) {
    client.commands.set('/ping', {
      description: '`/ping` - Check bot responsiveness.',
      category: 'General',
      adminOnly: false
    });
  }

  client.on('interactionCreate', async (interaction) => {
    try {
      if (!interaction.isChatInputCommand()) return;
      if (interaction.commandName !== 'ping') return;
      await interaction.reply('Pong!');
    } catch (err) {
      console.error('Error handling /ping command:', err);
    }
  });

  return [data.toJSON()];
}

module.exports = { registerSlash };
