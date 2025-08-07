const { EmbedBuilder } = require('discord.js');
const crypto = require('crypto');
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
  commands.set('!slots <bet>', {
    description: '`!slots <bet>` - Bet on a slot machine to win coins.',
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

      if (command === '!slots') {
        const bet = parseInt(args[0], 10);
        if (isNaN(bet) || bet <= 0) {
          return message.reply('Please provide a valid bet amount.');
        }
        const current = await getBalance(message.guild.id, message.author.id);
        if (current < bet) {
          return message.reply('You do not have enough coins for that bet.');
        }

        await incrementBalance(message.guild.id, message.author.id, -bet);

        const symbols = ['🍒', '🍋', '🍊', '🍇', '⭐'];
        const spin = [
          symbols[crypto.randomInt(symbols.length)],
          symbols[crypto.randomInt(symbols.length)],
          symbols[crypto.randomInt(symbols.length)]
        ];

        let payout = 0;
        if (spin[0] === spin[1] && spin[1] === spin[2]) {
          payout = bet * 10;
        } else if (spin[0] === spin[1] || spin[0] === spin[2] || spin[1] === spin[2]) {
          payout = bet * 2;
        }

        if (payout > 0) {
          await incrementBalance(message.guild.id, message.author.id, payout);
        }
        const balance = await getBalance(message.guild.id, message.author.id);

        const embed = new EmbedBuilder()
          .setTitle('Slots')
          .addFields(
            { name: 'Result', value: spin.join(' '), inline: false },
            {
              name: 'Outcome',
              value: payout > 0 ? `You won ${payout} coins!` : `You lost ${bet} coins.`,
              inline: false
            },
            { name: 'Balance', value: `${balance}`, inline: false }
          );
        return message.reply({ embeds: [embed] });
      }
    } catch (err) {
      console.error('Error handling economy commands:', err);
    }
  });
}

module.exports = { register };
