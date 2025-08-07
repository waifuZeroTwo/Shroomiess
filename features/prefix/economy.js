const { getBalance, incrementBalance, getLastWorkTimestamp, setLastWorkTimestamp } = require('../../database');

const COOLDOWN_MS = 60 * 60 * 1000;

function register(client, commands) {
  commands.set('!balance', {
    description: '`!balance` - Display your current balance.',
    category: 'Economy',
    adminOnly: false
  });
  commands.set('!work', {
    description: '`!work` - Work to earn a random amount once per hour.',
    category: 'Economy',
    adminOnly: false
  });

  client.on('messageCreate', async (message) => {
    try {
      if (message.author.bot) return;
      if (!message.guild) return;
      if (!message.content.startsWith('!')) return;

      const args = message.content.trim().split(/\s+/);
      const command = args.shift().toLowerCase();

      if (command === '!balance') {
        const balance = await getBalance(message.guild.id, message.author.id);
        return message.reply(`Your balance is ${balance}.`);
      }

      if (command === '!work') {
        const last = await getLastWorkTimestamp(message.guild.id, message.author.id);
        if (last && Date.now() - new Date(last).getTime() < COOLDOWN_MS) {
          const remaining = COOLDOWN_MS - (Date.now() - new Date(last).getTime());
          const minutes = Math.ceil(remaining / 60000);
          return message.reply(`You can work again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
        }
        const amount = Math.floor(Math.random() * 101) + 50;
        const balance = await incrementBalance(message.guild.id, message.author.id, amount);
        await setLastWorkTimestamp(message.guild.id, message.author.id);
        return message.reply(`You earned ${amount} coins. Your balance is now ${balance}.`);
      }
    } catch (err) {
      console.error('Error handling economy commands:', err);
    }
  });
}

module.exports = { register };
