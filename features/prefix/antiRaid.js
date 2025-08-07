const crypto = require('crypto');
const {
  getAntiRaidSettings,
  logAntiRaidEvent,
  getModLogChannel
} = require('../../database');

const joinTimestamps = new Map();
const memberJoinTimes = new Map();
const messageTimestamps = new Map();
const recentHashes = new Map();
const userInfractions = new Map();
const guildEventTimestamps = new Map();
const lockedGuilds = new Set();
const pendingVerifications = new Map();
const raidSummaries = new Map();

function recordSummary(guild, field, amount) {
  let summary = raidSummaries.get(guild.id);
  if (!summary) {
    summary = { joins: 0, spamMsgs: 0, timeout: null };
    raidSummaries.set(guild.id, summary);
  }
  summary[field] = (summary[field] || 0) + amount;
  if (!summary.timeout) {
    summary.timeout = setTimeout(() => {
      guild.client.emit('antiRaidSummary', {
        guildId: guild.id,
        joins: summary.joins,
        spamMsgs: summary.spamMsgs
      });
      summary.joins = 0;
      summary.spamMsgs = 0;
      summary.timeout = null;
    }, 10000);
  }
}

function generateChallenge(settings) {
  if (settings.verifyQuestion) {
    return settings.verifyQuestion;
  }
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  return { question: `What is ${a} + ${b}?`, answer: String(a + b) };
}

async function startVerification(member, settings) {
  try {
    const { question, answer } = generateChallenge(settings);
    pendingVerifications.set(member.id, {
      guildId: member.guild.id,
      question,
      answer: answer.toLowerCase()
    });
    try {
      await member.send(`Please answer the following to verify: ${question}`);
    } catch (_) {}
    const unverifiedRole = member.guild.roles.cache.find(
      (r) => r.name.toLowerCase() === 'unverified'
    );
    if (unverifiedRole && !member.roles.cache.has(unverifiedRole.id)) {
      try {
        await member.roles.add(unverifiedRole);
      } catch (_) {}
    }
    await logAntiRaidEvent(member.guild.id, 'verifyChallenge', {
      userId: member.id,
      question,
      timestamp: Date.now(),
      rule: 'verification',
      response: 'challenge'
    });
  } catch (_) {}
}

async function handleVerifyMessage(message) {
  if (message.author.bot || message.guild) return;
  const pending = pendingVerifications.get(message.author.id);
  if (!pending) return;
  const content = (message.content || '').trim();
  await logAntiRaidEvent(pending.guildId, 'verifyAttempt', {
    userId: message.author.id,
    answer: content,
    timestamp: Date.now(),
    rule: 'verification',
    response: 'attempt'
  });
  if (content.toLowerCase() === pending.answer) {
    pendingVerifications.delete(message.author.id);
    const guild = message.client.guilds.cache.get(pending.guildId);
    const member = await guild?.members
      .fetch(message.author.id)
      .catch(() => null);
    if (member) {
      const memberRole = guild.roles.cache.find(
        (r) => r.name.toLowerCase() === 'member'
      );
      const unverifiedRole = guild.roles.cache.find(
        (r) => r.name.toLowerCase() === 'unverified'
      );
      if (memberRole) {
        try {
          await member.roles.add(memberRole);
        } catch (_) {}
      }
      if (unverifiedRole) {
        try {
          await member.roles.remove(unverifiedRole);
        } catch (_) {}
      }
    }
    await message.reply('Verification successful! You now have access.').catch(() => {});
    await logAntiRaidEvent(pending.guildId, 'verifySuccess', {
      userId: message.author.id,
      timestamp: Date.now(),
      rule: 'verification',
      response: 'success'
    });
  } else {
    await message.reply('Incorrect answer. Please try again.').catch(() => {});
    await logAntiRaidEvent(pending.guildId, 'verifyFailure', {
      userId: message.author.id,
      answer: content,
      timestamp: Date.now(),
      rule: 'verification',
      response: 'failure'
    });
  }
}

async function lockdownGuild(guild, count) {
  lockedGuilds.add(guild.id);
  for (const channel of guild.channels.cache.values()) {
    if (channel.isTextBased && channel.isTextBased()) {
      try {
        await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
      } catch (_) {}
    }
  }
  try {
    const modChannelId = await getModLogChannel(guild.id);
    if (modChannelId) {
      const modChannel = guild.channels.cache.get(modChannelId);
      if (modChannel) {
        await modChannel.send('Lockdown activated due to raid detection.');
      }
    }
  } catch (_) {}
  guild.client.emit('antiRaidLockdown', { guild, count });
  await logAntiRaidEvent(guild.id, 'lockdown', {
    count,
    timestamp: Date.now(),
    rule: 'lockdownThreshold',
    response: 'lockdown'
  });
}

async function trackEvent(guild, settings) {
  const now = Date.now();
  let arr = guildEventTimestamps.get(guild.id);
  if (!arr) {
    arr = [];
    guildEventTimestamps.set(guild.id, arr);
  }
  arr.push(now);
  while (arr.length && now - arr[0] > 60 * 1000) arr.shift();
  if (!lockedGuilds.has(guild.id) && settings.lockdownThreshold && arr.length >= settings.lockdownThreshold) {
    await lockdownGuild(guild, arr.length);
  }
}

async function handleInfraction(guild, member, settings) {
  if (!member) return 'none';
  let guildMap = userInfractions.get(guild.id);
  if (!guildMap) {
    guildMap = new Map();
    userInfractions.set(guild.id, guildMap);
  }
  const count = (guildMap.get(member.id) || 0) + 1;
  guildMap.set(member.id, count);

  let response = 'none';
  const now = Date.now();

  if (settings.muteRoleId && count >= (settings.shadowMuteThreshold || 1) && !member.roles.cache.has(settings.muteRoleId)) {
    try {
      await member.roles.add(settings.muteRoleId, 'Anti-raid shadow mute');
    } catch (_) {}
    guild.client.emit('antiRaidShadowMute', { guild, user: member.user });
    response = 'shadowMute';
    await logAntiRaidEvent(guild.id, 'shadowMute', {
      userId: member.id,
      timestamp: now,
      rule: 'shadowMuteThreshold',
      response
    });
  }

  if (settings.suspectRoleId && count >= (settings.quarantineThreshold || 3) && !member.roles.cache.has(settings.suspectRoleId)) {
    try {
      await member.roles.add(settings.suspectRoleId, 'Anti-raid quarantine');
    } catch (_) {}
    guild.client.emit('antiRaidQuarantine', { guild, user: member.user });
    response = 'quarantine';
    await logAntiRaidEvent(guild.id, 'quarantine', {
      userId: member.id,
      timestamp: now,
      rule: 'quarantineThreshold',
      response
    });
  }

  await trackEvent(guild, settings);
  return response;
}

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
    joins.push({ time: now, userId: member.id });
    const window = (settings.joinThreshold?.seconds || 10) * 1000;
    while (joins.length && now - joins[0].time > window) joins.shift();
    if (settings.joinThreshold && joins.length >= settings.joinThreshold.count) {
      const userIds = joins.map((j) => j.userId);
      member.client.emit('antiRaidJoinSpike', { guild: member.guild, count: joins.length });
      recordSummary(member.guild, 'joins', 1);
      await logAntiRaidEvent(guildId, 'joinSpike', {
        userIds,
        count: joins.length,
        timestamp: now,
        rule: 'joinThreshold',
        response: 'none'
      });
      await trackEvent(member.guild, settings);
    }
    let guildMap = memberJoinTimes.get(guildId);
    if (!guildMap) {
      guildMap = new Map();
      memberJoinTimes.set(guildId, guildMap);
    }
    guildMap.set(member.id, now);
    await startVerification(member, settings);
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
      message.client.emit('antiRaidSpamDetected', {
        guild: message.guild,
        user: message.author,
        count: timestamps.length
      });
      recordSummary(message.guild, 'spamMsgs', 1);
      const response = await handleInfraction(message.guild, message.member, settings);
      await logAntiRaidEvent(guildId, 'msgSpike', {
        userId: message.author.id,
        count: timestamps.length,
        timestamp: now,
        rule: 'msgThreshold',
        response
      });
    }

    const domains = extractDomains(message.content || '');
    for (const domain of domains) {
      if (!settings.whitelist || !settings.whitelist.includes(domain)) {
        recordSummary(message.guild, 'spamMsgs', 1);
        const response = await handleInfraction(message.guild, message.member, settings);
        message.client.emit('antiRaidSpamDetected', {
          guild: message.guild,
          user: message.author,
          count: 1
        });
        await logAntiRaidEvent(guildId, 'filteredInvite', {
          userId: message.author.id,
          domain,
          timestamp: now,
          rule: 'inviteFilter',
          response
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
            user: message.author,
            hash,
            count: entry.users.size
          });
          recordSummary(message.guild, 'spamMsgs', 1);
          const response = await handleInfraction(message.guild, message.member, settings);
          await logAntiRaidEvent(guildId, 'duplicateContent', {
            hash,
            users: Array.from(entry.users),
            timestamp: now,
            rule: 'duplicateContent',
            response
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
  client.on('messageCreate', handleVerifyMessage);
}

module.exports = { register, startVerification, pendingVerifications };
