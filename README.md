# Shroomiess Bot

Shroomiess is a Discord.js bot focused on moderation, community tools, and anti‑raid protection.  
It supports legacy prefix commands (`!`) and modern slash commands (`/`), all auto‑registered at startup.

## Features

- **General utilities** – Ping test, contextual help DM.
- **Moderation** – Ban, unban, kick, temporary mute, warning system with auto‑mute, ban query stats, mod‑log channel.
- **Reputation** – Daily reputation awards with Bronze/Silver/Gold badge milestones.
- **Birthdays** – Users record birthdays; bot announces them and can assign a role. Date formats and channels are configurable.
- **Modmail** – DM-based support tickets with claim/unclaim/close workflow and transcript retrieval.
- **Anti‑Raid** – Join/message spike detection, link whitelist, verification challenges, shadow mutes, quarantines, and optional lockdowns.
- **Logging** – Moderation actions, reputation transactions, modmail events, and anti‑raid summaries can all be sent to a chosen channel.

## Installation

1. Install **Node.js 18+** and a **MongoDB** instance.
2. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/your-username/Shroomiess.git
   cd Shroomiess
   npm install
   ```

3. Create a `.env` file:

   ```dotenv
   DISCORD_BOT_TOKEN=your_bot_token
   MONGODB_URI=your_mongodb_connection_string
   MONGODB_DB=your_database_name   # optional override
   DB_PASSWORD=your_mongodb_user_password   # used by database/mongoClient.js
   GUILD_ID=development_guild_id   # optional; registers slash commands to this guild when not in production
   ```

4. Start the bot:

   ```bash
   npm start
   ```

## Command Reference

### General
| Prefix | Slash | Description |
| ------ | ----- | ----------- |
| `!ping` | `/ping` | Check bot responsiveness. |
| `!help` | `/help` | DM a categorized list of commands. |

### Moderation
| Prefix | Slash | Description |
| ------ | ----- | ----------- |
| `!ban <@user\|userId> [reason]` | `/ban <user> [reason]` | Ban a user and record the reason. |
| `!unban <userId>` | `/unban <userid>` | Remove a ban and unban the user. |
| `!kick <@user\|userId> [reason]` | `/kick <user> [reason]` | Kick a user from the guild. |
| `!banexplain` | `/banexplain` | Display MongoDB query stats for the ban collection. |
| `!mute <@user\|userId> <duration> [reason]` | `/mute <user> <duration> [reason]` | Temporarily mute a user. (`s`, `m`, `h`, `d`) |
| `!unmute <userId>` | `/unmute <userid>` | Remove a mute from a user. |
| `!warn <@user\|userId> [reason]` | `/warn <user> [reason]` | Log a warning for a user. |
| `!warnings <userId>` | `/warnings <userid>` | List warnings for a user. |
| `!setmodlog <#channel>` | — | Set the channel where moderation actions are logged. |
| — | `/antiraid …` | Configure anti‑raid thresholds, link whitelist, roles, and verification question. |
| — | `/verify` | Resend or reset your anti‑raid verification challenge. |

### Modmail
Prefix and slash commands `claim`, `unclaim`, `close`, and `ticketlog` manage modmail tickets in dedicated channels.  
Users DM the bot to open a ticket; staff claim, converse, and close with transcripts saved to `ticket_logs/`.

### Birthdays
- `!setbirthday <date>` / `/setbirthday <date>`
- `!clearbirthday` / `/clearbirthday`
- `!birthdays` / `/birthdays`
- `!setbirthdaychannel <#channel>` / `/setbirthdaychannel <#channel>`
- `!setbirthdayrole <@role>` / `/setbirthdayrole <@role>`
- `!setbirthdayformat <format>` / `/setbirthdayformat <format>`
  
Formats: `YYYY-MM-DD`, `MM/DD`, `DD/MM`, `DD.MM.YYYY`.

### Reputation
- `!rep @User <reason>` / `/rep @User <reason>`
- `!reputation [@User]` / `/reputation [@User]`

Award reputation once per day per recipient. Badges unlock at 10 (Bronze), 50 (Silver), and 100 (Gold) points.

## Data Storage

MongoDB collections persist bans, warnings, mutes, guild settings, birthdays, reputation, and anti‑raid events.  
Active bans and mutes are re‑applied when the bot starts.

## Logging

When a mod‑log channel is configured, the bot logs bans, kicks, mutes, warnings, reputation transactions, modmail updates, and anti‑raid events as embeds.

## Anti‑Raid Summary

The anti‑raid module:
- Detects join and message spikes.
- Filters links against a whitelist.
- Issues verification challenges via `/verify`.
- Applies shadow mutes or quarantine roles.
- Can trigger server lockdowns.
- Emits periodic join/spam summaries.

## Directory Overview

```
features/
  prefix/  - legacy `!` commands
  slash/   - slash command counterparts
database/  - MongoDB helpers and anti-raid settings
ticket_logs/ - generated modmail transcripts
```

---

Happy mushrooming!
