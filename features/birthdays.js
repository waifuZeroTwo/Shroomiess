const { PermissionsBitField } = require('discord.js');
const {
  setBirthday,
  clearBirthday,
  listBirthdays,
  setBirthdayChannel,
  getBirthdayChannel,
  setBirthdayRole,
  getBirthdayRole,
  setBirthdayFormat,
  getBirthdayFormat
} = require('../database');

const DATE_FORMATS = ['YYYY-MM-DD', 'MM/DD', 'DD/MM', 'DD.MM.YYYY'];

function formatDate(dateStr, format) {
  const [year, month, day] = dateStr.split('-');
  switch (format) {
    case 'MM/DD':
      return `${month}/${day}`;
    case 'DD/MM':
      return `${day}/${month}`;
    case 'DD.MM.YYYY':
      return `${day}.${month}.${year}`;
    case 'YYYY-MM-DD':
    default:
      return `${year}-${month}-${day}`;
  }
}

function register(client, commands) {
  commands.set('!setbirthday', '`!setbirthday YYYY-MM-DD` - store your birthday.');
  commands.set('!clearbirthday', '`!clearbirthday` - remove your birthday.');
  commands.set('!birthdays', '`!birthdays` - list upcoming birthdays.');
  commands.set(
    '!setbirthdaychannel',
    '`!setbirthdaychannel <#channel>` - set channel for birthday messages (ManageGuild).'
  );
  commands.set(
    '!setbirthdayrole',
    '`!setbirthdayrole <@role>` - set role assigned on birthdays (ManageGuild).'
  );
  commands.set(
    '!setbirthdayformat',
    `!setbirthdayformat <format> - set birthday date format. Formats: ${DATE_FORMATS.join(', ')} (ManageGuild).`
  );

  client.on('messageCreate', async (message) => {
    try {
      if (message.author.bot) return;
      if (!message.guild) return;
      if (!message.content.startsWith('!')) return;

      const args = message.content.trim().split(/\s+/);
      const command = args.shift().toLowerCase();

      if (command === '!setbirthday') {
        const date = args[0];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return message.reply('Please use the format YYYY-MM-DD.');
        }
        await setBirthday({
          guildId: message.guild.id,
          userId: message.author.id,
          date
        });
        return message.reply('Your birthday has been saved.');
      }

      if (command === '!clearbirthday') {
        await clearBirthday(message.guild.id, message.author.id);
        return message.reply('Your birthday has been removed.');
      }

      if (command === '!birthdays') {
        const birthdays = await listBirthdays(message.guild.id);
        if (!birthdays.length) {
          return message.reply('No birthdays recorded.');
        }
        const format = (await getBirthdayFormat(message.guild.id)) || 'YYYY-MM-DD';
        const months = Array.from({ length: 12 }, () => []);
        for (const b of birthdays) {
          const [year, month, day] = b.date.split('-').map(Number);
          months[month - 1].push({ date: b.date, day, userId: b.userId });
        }
        const monthNames = [
          'January',
          'February',
          'March',
          'April',
          'May',
          'June',
          'July',
          'August',
          'September',
          'October',
          'November',
          'December'
        ];
        const lines = [];
        for (let i = 0; i < months.length; i++) {
          const arr = months[i].sort((a, b) => a.day - b.day);
          if (!arr.length) continue;
          lines.push(`**${monthNames[i]}**`);
          for (const item of arr) {
            lines.push(`${formatDate(item.date, format)} - <@${item.userId}>`);
          }
        }
        return message.channel.send(lines.join('\n'));
      }

      if (command === '!setbirthdaychannel') {
        if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
          return message.reply('You do not have permission to use this command.');
        }
        const channel = message.mentions.channels.first();
        if (!channel) {
          return message.reply('Please mention a channel.');
        }
        await setBirthdayChannel(message.guild.id, channel.id);
        return message.reply(`Birthday channel set to ${channel}.`);
      }

      if (command === '!setbirthdayrole') {
        if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
          return message.reply('You do not have permission to use this command.');
        }
        const role = message.mentions.roles.first();
        if (!role) {
          return message.reply('Please mention a role.');
        }
        await setBirthdayRole(message.guild.id, role.id);
        return message.reply(`Birthday role set to ${role}.`);
      }

      if (command === '!setbirthdayformat') {
        if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
          return message.reply('You do not have permission to use this command.');
        }
        const format = args[0];
        if (!DATE_FORMATS.includes(format)) {
          return message.reply(`Format must be one of: ${DATE_FORMATS.join(', ')}`);
        }
        await setBirthdayFormat(message.guild.id, format);
        return message.reply(`Birthday format set to ${format}.`);
      }
    } catch (err) {
      console.error('Error handling birthday command:', err);
    }
  });

  client.once('ready', () => {
    async function checkBirthdays() {
      const today = new Date();
      const month = today.getUTCMonth() + 1;
      const day = today.getUTCDate();
      for (const guild of client.guilds.cache.values()) {
        try {
          const channelId = await getBirthdayChannel(guild.id);
          const roleId = await getBirthdayRole(guild.id);
          if (!channelId && !roleId) continue;
          const birthdays = await listBirthdays(guild.id);
          for (const b of birthdays) {
            const [year, m, d] = b.date.split('-').map(Number);
            if (m === month && d === day) {
              if (channelId) {
                const channel =
                  guild.channels.cache.get(channelId) ||
                  (await guild.channels.fetch(channelId).catch(() => null));
                if (channel) {
                  await channel.send(`Happy birthday <@${b.userId}>!`);
                }
              }
              if (roleId) {
                const member = await guild.members
                  .fetch(b.userId)
                  .catch(() => null);
                if (member) {
                  await member.roles.add(roleId).catch(() => null);
                  setTimeout(() => {
                    member.roles.remove(roleId).catch(() => null);
                  }, 24 * 60 * 60 * 1000);
                }
              }
            }
          }
        } catch (err) {
          console.error('Failed to process birthdays for guild', guild.id, err);
        }
      }
    }

    checkBirthdays();
    setInterval(checkBirthdays, 24 * 60 * 60 * 1000);
  });
}

module.exports = { register };
