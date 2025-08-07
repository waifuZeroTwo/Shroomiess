const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const {
  setJoinThreshold,
  setMsgThreshold,
  setShadowMuteThreshold,
  setQuarantineThreshold,
  setLockdownThreshold,
  setMuteRole,
  setSuspectRole,
  addWhitelistDomain,
  removeWhitelistDomain,
  setVerifyQuestion,
  getAntiRaidSettings,
  logAntiRaidEvent
} = require('../../database');
const { startVerification, pendingVerifications } = require('../prefix/antiRaid');

async function registerSlash(client) {
  const cmd = new SlashCommandBuilder()
    .setName('antiraid')
    .setDescription('Configure anti-raid settings')
    .addSubcommandGroup((group) =>
      group
        .setName('set')
        .setDescription('Set thresholds')
        .addSubcommand((sub) =>
          sub
            .setName('join-threshold')
            .setDescription('Set join spike threshold')
            .addIntegerOption((opt) =>
              opt.setName('count').setDescription('Join count').setRequired(true)
            )
            .addIntegerOption((opt) =>
              opt
                .setName('seconds')
                .setDescription('Time window in seconds')
                .setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('msg-threshold')
            .setDescription('Set message spam threshold')
            .addIntegerOption((opt) =>
              opt.setName('count').setDescription('Message count').setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('shadow-mute')
            .setDescription('Set shadow mute threshold and role')
            .addIntegerOption((opt) =>
              opt.setName('count').setDescription('Infraction count').setRequired(true)
            )
            .addRoleOption((opt) =>
              opt.setName('role').setDescription('Muted role').setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('quarantine')
            .setDescription('Set quarantine threshold and role')
            .addIntegerOption((opt) =>
              opt.setName('count').setDescription('Infraction count').setRequired(true)
            )
            .addRoleOption((opt) =>
              opt.setName('role').setDescription('Suspect role').setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('lockdown')
            .setDescription('Set lockdown threshold (events per minute)')
            .addIntegerOption((opt) =>
              opt.setName('count').setDescription('Event count').setRequired(true)
            )
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName('whitelist')
        .setDescription('Manage link whitelist')
        .addSubcommand((sub) =>
          sub
            .setName('add')
            .setDescription('Add domain to whitelist')
            .addStringOption((opt) =>
              opt.setName('domain').setDescription('Domain').setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('remove')
            .setDescription('Remove domain from whitelist')
            .addStringOption((opt) =>
              opt.setName('domain').setDescription('Domain').setRequired(true)
            )
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName('verify-question')
        .setDescription('Verification question')
        .addSubcommand((sub) =>
          sub
            .setName('set')
            .setDescription('Set verification question')
            .addStringOption((opt) =>
              opt.setName('question').setDescription('Question').setRequired(true)
            )
            .addStringOption((opt) =>
              opt.setName('answer').setDescription('Answer').setRequired(true)
            )
        )
    );

  const verifyCmd = new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Manage verification challenges')
    .addSubcommand((sub) =>
      sub.setName('question').setDescription('Resend your verification question')
    )
    .addSubcommand((sub) =>
      sub.setName('reset').setDescription('Reset and generate a new challenge')
    );

  if (client.commands) {
    client.commands.set('/antiraid', {
      description: '`/antiraid` - Configure anti-raid settings.',
      category: 'Moderation',
      adminOnly: true
    });
    client.commands.set('/verify', {
      description: '`/verify` - Manage verification challenge.',
      category: 'General'
    });
  }

  client.on('interactionCreate', async (interaction) => {
    try {
      if (!interaction.isChatInputCommand()) return;
      if (interaction.commandName === 'antiraid') {
        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild)) {
          return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }
        const group = interaction.options.getSubcommandGroup();
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;
        if (group === 'set' && sub === 'join-threshold') {
          const count = interaction.options.getInteger('count', true);
          const seconds = interaction.options.getInteger('seconds', true);
          await setJoinThreshold(guildId, count, seconds);
          await interaction.reply(`Join threshold set to ${count} joins in ${seconds} seconds.`);
        } else if (group === 'set' && sub === 'msg-threshold') {
          const count = interaction.options.getInteger('count', true);
          await setMsgThreshold(guildId, count);
          await interaction.reply(`Message threshold set to ${count} messages/5s.`);
        } else if (group === 'set' && sub === 'shadow-mute') {
          const count = interaction.options.getInteger('count', true);
          const role = interaction.options.getRole('role', true);
          await setShadowMuteThreshold(guildId, count);
          await setMuteRole(guildId, role.id);
          await interaction.reply(`Shadow mute after ${count} infraction(s) using role ${role}.`);
        } else if (group === 'set' && sub === 'quarantine') {
          const count = interaction.options.getInteger('count', true);
          const role = interaction.options.getRole('role', true);
          await setQuarantineThreshold(guildId, count);
          await setSuspectRole(guildId, role.id);
          await interaction.reply(`Quarantine after ${count} infraction(s) using role ${role}.`);
        } else if (group === 'set' && sub === 'lockdown') {
          const count = interaction.options.getInteger('count', true);
          await setLockdownThreshold(guildId, count);
          await interaction.reply(`Lockdown triggered after ${count} flagged events/min.`);
        } else if (group === 'whitelist' && sub === 'add') {
          const domain = interaction.options.getString('domain', true);
          await addWhitelistDomain(guildId, domain);
          await interaction.reply(`Added \`${domain}\` to whitelist.`);
        } else if (group === 'whitelist' && sub === 'remove') {
          const domain = interaction.options.getString('domain', true);
          await removeWhitelistDomain(guildId, domain);
          await interaction.reply(`Removed \`${domain}\` from whitelist.`);
        } else if (group === 'verify-question' && sub === 'set') {
          const question = interaction.options.getString('question', true);
          const answer = interaction.options.getString('answer', true);
          await setVerifyQuestion(guildId, question, answer);
          await interaction.reply('Verification question set.');
        }
      } else if (interaction.commandName === 'verify') {
        const sub = interaction.options.getSubcommand();
        const pending = pendingVerifications.get(interaction.user.id);
        if (sub === 'question') {
          if (!pending) {
            return interaction.reply({ content: 'You have no active verification challenge.', ephemeral: true });
          }
          try {
            await interaction.user.send(`Please answer: ${pending.question}`);
          } catch (_) {}
          await interaction.reply({ content: 'Verification question sent to your DMs.', ephemeral: true });
        } else if (sub === 'reset') {
          const settings = await getAntiRaidSettings(interaction.guildId);
          await startVerification(interaction.member, settings);
          await logAntiRaidEvent(interaction.guildId, 'verifyReset', { userId: interaction.user.id });
          await interaction.reply({ content: 'New verification challenge sent to your DMs.', ephemeral: true });
        }
      }
    } catch (err) {
      console.error('Error handling antiraid slash command:', err);
      if (interaction.isRepliable()) {
        try {
          await interaction.reply({ content: 'Failed to process command.', ephemeral: true });
        } catch (_) {}
      }
    }
  });

  return [cmd.toJSON(), verifyCmd.toJSON()];
}

module.exports = { registerSlash };
