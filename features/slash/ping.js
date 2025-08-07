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

  try {
    await client.application.commands.create(data.toJSON());
  } catch (err) {
    console.error('Failed to register /ping:', err);
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
}

module.exports = { registerSlash };
