function register(client, commands) {
  commands.set('!ping', {
    description: '`!ping` - Check bot responsiveness.',
    category: 'General',
    adminOnly: false
  });

  client.on('messageCreate', async (message) => {
    try {
      if (message.author.bot) return;
      if (!message.content.startsWith('!')) return;

      const args = message.content.trim().split(/\s+/);
      const command = args.shift().toLowerCase();

      if (command === '!ping') {
        return message.reply('Pong!');
      }
    } catch (err) {
      console.error('Error handling ping command:', err);
    }
  });
}

module.exports = { register };
