const { awardReputation, getReputation, getLastRepTimestamp, addBadge } = require('../database');

const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const BADGE_THRESHOLDS = [
  { name: 'Bronze', points: 10 },
  { name: 'Silver', points: 50 },
  { name: 'Gold', points: 100 }
];

function register(client, commands) {
  commands.set('!rep', {
    description: '`!rep @User <reason>` - Give a reputation point to a user.',
    category: 'Reputation',
    adminOnly: false
  });
  commands.set('!reputation', {
    description: '`!reputation [@User]` - Show a user\'s reputation and badges.',
    category: 'Reputation',
    adminOnly: false
  });

  client.on('messageCreate', async (message) => {
    try {
      if (message.author.bot) return;
      if (!message.guild) return;
      if (!message.content.startsWith('!')) return;

      const args = message.content.trim().split(/\s+/);
      const command = args.shift().toLowerCase();

      if (command === '!rep') {
        const user = message.mentions.users.first();
        if (!user) {
          return message.reply('Please mention a user to award reputation to.');
        }
        if (user.id === message.author.id) {
          return message.reply('You cannot award reputation to yourself.');
        }
        if (user.bot) {
          return message.reply('You cannot award reputation to bots.');
        }
        const reason = args.join(' ').trim();
        if (!reason) {
          return message.reply('Please provide a reason for awarding reputation.');
        }

        const lastTimestamp = await getLastRepTimestamp(
          message.guild.id,
          message.author.id,
          user.id
        );
        if (
          lastTimestamp &&
          Date.now() - new Date(lastTimestamp).getTime() < COOLDOWN_MS
        ) {
          return message.reply(
            'You can only award reputation to that user once every 24 hours.'
          );
        }

        const rep = await awardReputation({
          guildId: message.guild.id,
          fromUserId: message.author.id,
          toUserId: user.id,
          reason
        });

        let newBadge = null;
        for (const { name, points } of BADGE_THRESHOLDS) {
          if (rep.points >= points && !rep.badges.includes(name)) {
            await addBadge(message.guild.id, user.id, name);
            newBadge = name;
          }
        }

        await message.reply(
          `Reputation point awarded to ${user}. They now have ${rep.points} point${
            rep.points === 1 ? '' : 's'
          }.`
        );

        if (newBadge) {
          const member = await message.guild.members
            .fetch(user.id)
            .catch(() => null);
          if (member) {
            member
              .send(
                `🎉 You have unlocked the **${newBadge}** reputation badge in ${message.guild.name}!`
              )
              .catch(() => {});
          }
        }

        client.emit('reputation', {
          guildId: message.guild.id,
          fromUserId: message.author.id,
          toUserId: user.id,
          reason
        });
      }

      if (command === '!reputation') {
        const user = message.mentions.users.first() || message.author;
        const rep = await getReputation(message.guild.id, user.id);
        const badges = rep.badges.length ? rep.badges.join(', ') : 'None';
        return message.reply(
          `${user} has ${rep.points} reputation point${
            rep.points === 1 ? '' : 's'
          }. Badges: ${badges}.`
        );
      }
    } catch (err) {
      console.error('Error handling reputation commands:', err);
    }
  });
}

module.exports = { register };
