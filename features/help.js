function register(client, commands) {
  commands.set('!help', '`!help` - Show available commands.');

  client.on('messageCreate', async (message) => {
    try {
      if (message.author.bot) return;
      if (!message.content.startsWith('!')) return;

      const args = message.content.trim().split(/\s+/);
      const command = args.shift().toLowerCase();

      if (command === '!help') {
        const lines = ['**Available Commands**'];
        for (const [, desc] of commands) {
          lines.push(desc);
        }
        return message.channel.send(lines.join('\n'));
      }
    } catch (err) {
      console.error('Error handling help command:', err);
    }
  });
}

module.exports = { register };
