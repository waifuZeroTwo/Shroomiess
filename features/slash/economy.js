const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const crypto = require('crypto');
const { getBalance, incrementBalance, getLastWorkTimestamp, setLastWorkTimestamp } = require('../../database');

const COOLDOWN_MS = 60 * 60 * 1000;

async function registerSlash(client) {
  const balance = new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Display your current balance.');

  const work = new SlashCommandBuilder()
    .setName('work')
    .setDescription('Work to earn a random amount once per hour.');

  const slots = new SlashCommandBuilder()
    .setName('slots')
    .setDescription('Bet on a slot machine to win coins.')
    .addIntegerOption((option) =>
      option.setName('bet').setDescription('Amount to bet').setRequired(true)
    );

  if (client.commands) {
    client.commands.set('/balance', {
      description: '`/balance` - Display your current balance.',
      category: 'Economy',
      adminOnly: false
    });
    client.commands.set('/work', {
      description: '`/work` - Work to earn a random amount once per hour.',
      category: 'Economy',
      adminOnly: false
    });
    client.commands.set('/slots <bet>', {
      description: '`/slots <bet>` - Bet on a slot machine to win coins.',
      category: 'Economy',
      adminOnly: false
    });
  }

  client.on('interactionCreate', async (interaction) => {
    try {
      if (!interaction.isChatInputCommand()) return;
      if (interaction.commandName === 'balance') {
        const bal = await getBalance(interaction.guildId, interaction.user.id);
        await interaction.reply(`Your balance is ${bal}.`);
      } else if (interaction.commandName === 'work') {
        const last = await getLastWorkTimestamp(interaction.guildId, interaction.user.id);
        if (last && Date.now() - new Date(last).getTime() < COOLDOWN_MS) {
          const remaining = COOLDOWN_MS - (Date.now() - new Date(last).getTime());
          const minutes = Math.ceil(remaining / 60000);
          return interaction.reply({
            content: `You can work again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
            ephemeral: true
          });
        }
        const amount = Math.floor(Math.random() * 101) + 50;
        const bal = await incrementBalance(interaction.guildId, interaction.user.id, amount);
        await setLastWorkTimestamp(interaction.guildId, interaction.user.id);
        await interaction.reply(`You earned ${amount} coins. Your balance is now ${bal}.`);
      } else if (interaction.commandName === 'slots') {
        const bet = interaction.options.getInteger('bet', true);
        if (bet <= 0) {
          return interaction.reply({ content: 'Please provide a valid bet amount.', ephemeral: true });
        }
        const current = await getBalance(interaction.guildId, interaction.user.id);
        if (current < bet) {
          return interaction.reply({ content: 'You do not have enough coins for that bet.', ephemeral: true });
        }

        await incrementBalance(interaction.guildId, interaction.user.id, -bet);

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
          await incrementBalance(interaction.guildId, interaction.user.id, payout);
        }
        const bal = await getBalance(interaction.guildId, interaction.user.id);

        const embed = new EmbedBuilder()
          .setTitle('Slots')
          .addFields(
            { name: 'Result', value: spin.join(' '), inline: false },
            {
              name: 'Outcome',
              value: payout > 0 ? `You won ${payout} coins!` : `You lost ${bet} coins.`,
              inline: false
            },
            { name: 'Balance', value: `${bal}`, inline: false }
          );

        await interaction.reply({ embeds: [embed] });
      }
    } catch (err) {
      console.error('Error handling economy slash commands:', err);
    }
  });

  return [balance.toJSON(), work.toJSON(), slots.toJSON()];
}

module.exports = { registerSlash };
