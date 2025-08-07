const { SlashCommandBuilder } = require('discord.js');
const { getBalance, incrementBalance, getLastWorkTimestamp, setLastWorkTimestamp } = require('../../database');

const COOLDOWN_MS = 60 * 60 * 1000;

async function registerSlash(client) {
  const balance = new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Display your current balance.');

  const work = new SlashCommandBuilder()
    .setName('work')
    .setDescription('Work to earn a random amount once per hour.');

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
      }
    } catch (err) {
      console.error('Error handling economy slash commands:', err);
    }
  });

  return [balance.toJSON(), work.toJSON()];
}

module.exports = { registerSlash };
