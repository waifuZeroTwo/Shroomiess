const crypto = require('crypto');
const {
  getAntiRaidSettings,
  logAntiRaidEvent
} = require('../../database');

const joinTimestamps = new Map();
const memberJoinTimes = new Map();
const messageTimestamps = new Map();
const recentHashes = new Map();

async function handleGuildMemberAdd(member) {
  try {
    const guildId = member.guild.id;
    const settings = await getAntiRaidSettings(guildId);
    const now = Date.now();
    let joins = joinTimestamps.get(guildId);
    if (!joins) {
      joins = [];
      joinTimestamps.set(guildId, joins);
    }
    joins.push(now);
    const window = (settings.joinThreshold?.seconds || 10) * 1000;
    while (joins.length && now - joins[0] > window) joins.shift();
    if (settings.joinThreshold && joins.length >= settings.joinThreshold.count) {
      member.client.emit('antiRaidJoinSpike', { guild: member.guild, count: joins.length });
      await logAntiRaidEvent(guildId, 'joinSpike', { count: joins.length });
    }
    let guildMap = memberJoinTimes.get(guildId);
    if (!guildMap) {
      guildMap = new Map();
      memberJoinTimes.set(guildId, guildMap);
    }
    guildMap.set(member.id, now);
  } catch (err) {
    console.error('antiRaid guildMemberAdd error:', err);
  }
}

function extractDomains(content) {
  const matches = content.match(/https?:\/\/[^\s]+/gi) || [];
  const domains = [];
  for (const url of matches) {
    try {
      const d = new URL(url).hostname.replace(/^www\./, '');
      domains.push(d);
    } catch (e) {
      // ignore
    }
  }
  return domains;
}

async function handleMessage(message) {
  try {
    if (message.author.bot || !message.guild) return;
    const guildId = message.guild.id;
    const now = Date.now();
    const settings = await getAntiRaidSettings(guildId);
    const joinMap = memberJoinTimes.get(guildId);
    const joinTime = joinMap ? joinMap.get(message.author.id) : null;
    const isNew = joinTime && now - joinTime < 10 * 60 * 1000;
    if (!isNew) return;

    let guildMsgs = messageTimestamps.get(guildId);
    if (!guildMsgs) {
      guildMsgs = new Map();
      messageTimestamps.set(guildId, guildMsgs);
    }
    let timestamps = guildMsgs.get(message.author.id);
    if (!timestamps) {
      timestamps = [];
      guildMsgs.set(message.author.id, timestamps);
    }
    timestamps.push(now);
    while (timestamps.length && now - timestamps[0] > 5000) timestamps.shift();
    if (settings.msgThreshold && timestamps.length > settings.msgThreshold) {
      message.client.emit('antiRaidSpamDetected', { guild: message.guild, user: message.author });
      await logAntiRaidEvent(guildId, 'msgSpike', {
        userId: message.author.id,
        count: timestamps.length
      });
    }

    const domains = extractDomains(message.content || '');
    for (const domain of domains) {
      if (!settings.whitelist || !settings.whitelist.includes(domain)) {
        await logAntiRaidEvent(guildId, 'filteredInvite', {
          userId: message.author.id,
          domain
        });
        message.delete().catch(() => {});
        return;
      }
    }

    const content = message.content || '';
    if (content) {
      const hash = crypto.createHash('sha1').update(content).digest('hex');
      let guildHashes = recentHashes.get(guildId);
      if (!guildHashes) {
        guildHashes = new Map();
        recentHashes.set(guildId, guildHashes);
      }
      let entry = guildHashes.get(hash);
      if (!entry || now - entry.timestamp > 30000) {
        entry = { users: new Set([message.author.id]), timestamp: now };
        guildHashes.set(hash, entry);
      } else {
        entry.users.add(message.author.id);
        entry.timestamp = now;
        if (entry.users.size > 1) {
          message.client.emit('antiRaidSpamDetected', {
            guild: message.guild,
            hash
          });
          await logAntiRaidEvent(guildId, 'duplicateContent', {
            hash,
            users: Array.from(entry.users)
          });
        }
      }
    }
  } catch (err) {
    console.error('antiRaid messageCreate error:', err);
  }
}

function register(client) {
  client.on('guildMemberAdd', handleGuildMemberAdd);
  client.on('messageCreate', handleMessage);
}

module.exports = { register };
