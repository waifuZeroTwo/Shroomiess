const { SlashCommandBuilder } = require('discord.js');
const {
  awardReputation,
  getReputation,
  getLastRepTimestamp,
  addBadge
} = require('../../database');

const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const BADGE_THRESHOLDS = [
  { name: 'Bronze', points: 10 },
  { name: 'Silver', points: 50 },
  { name: 'Gold', points: 100 }
];

async function registerSlash(client) {
  const rep = new SlashCommandBuilder()
    .setName('rep')
    .setDescription('Give a reputation point to a user.')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to award').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('Reason for awarding').setRequired(true)
    );

  const reputation = new SlashCommandBuilder()
    .setName('reputation')
    .setDescription("Show a user's reputation and badges.")
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to view').setRequired(false)
    );

  if (client.commands) {
    client.commands.set('/rep', {
      description: '`/rep @User <reason>` - Give a reputation point to a user.',
      category: 'Reputation',
      adminOnly: false
    });
    client.commands.set('/reputation', {
      description: '`/reputation [@User]` - Show a user\'s reputation and badges.',
      category: 'Reputation',
      adminOnly: false
    });
  }

  try {
    await client.application.commands.create(rep.toJSON());
    await client.application.commands.create(reputation.toJSON());
  } catch (err) {
    console.error('Failed to register reputation slash commands:', err);
  }

  client.on('interactionCreate', async (interaction) => {
    try {
      if (!interaction.isChatInputCommand()) return;
      const { commandName } = interaction;
      if (commandName === 'rep') {
        const user = interaction.options.getUser('user', true);
        if (user.bot) {
          return interaction.reply({ content: 'You cannot award reputation to bots.', ephemeral: true });
        }
        if (user.id === interaction.user.id) {
          return interaction.reply({ content: 'You cannot award reputation to yourself.', ephemeral: true });
        }
        const reason = interaction.options.getString('reason', true);
        const lastTimestamp = await getLastRepTimestamp(
          interaction.guildId,
          interaction.user.id,
          user.id
        );
        if (lastTimestamp && Date.now() - new Date(lastTimestamp).getTime() < COOLDOWN_MS) {
          return interaction.reply({
            content: 'You can only award reputation to that user once every 24 hours.',
            ephemeral: true
          });
        }
        const rep = await awardReputation({
          guildId: interaction.guildId,
          fromUserId: interaction.user.id,
          toUserId: user.id,
          reason
        });
        const giverRep = await getReputation(
          interaction.guildId,
          interaction.user.id
        );
        let newBadge = null;
        for (const { name, points } of BADGE_THRESHOLDS) {
          if (rep.points >= points && !rep.badges.includes(name)) {
            await addBadge(interaction.guildId, user.id, name);
            newBadge = name;
          }
        }
        await interaction.reply(
          `Reputation point awarded to ${user}. They now have ${rep.points} point${
            rep.points === 1 ? '' : 's'
          }.`
        );
        if (newBadge) {
          const member = await interaction.guild.members.fetch(user.id).catch(() => null);
          if (member) {
            member
              .send(
                `🎉 You have unlocked the **${newBadge}** reputation badge in ${interaction.guild.name}!`
              )
              .catch(() => {});
          }
        }
        client.emit('reputation', {
          guildId: interaction.guildId,
          fromUserId: interaction.user.id,
          toUserId: user.id,
          reason,
          giverTotal: giverRep.points,
          receiverTotal: rep.points
        });
      } else if (commandName === 'reputation') {
        const user = interaction.options.getUser('user') || interaction.user;
        const rep = await getReputation(interaction.guildId, user.id);
        const badges = rep.badges.length ? rep.badges.join(', ') : 'None';
        await interaction.reply(
          `${user} has ${rep.points} reputation point${
            rep.points === 1 ? '' : 's'
          }. Badges: ${badges}.`
        );
      }
    } catch (err) {
      console.error('Error handling reputation slash command:', err);
    }
  });
}

module.exports = { registerSlash };
