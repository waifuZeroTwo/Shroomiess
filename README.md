# Shroomiess Bot

Discord bot with moderation features.

## Configuration

Create a `.env` file with the following values:

```
DISCORD_BOT_TOKEN=your_bot_token
MONGODB_URI=your_mongodb_connection_string
```

The bot connects to MongoDB to store active bans.

## Commands

- `!ping` – basic ping.
- `!ban @user [reason]` – bans the mentioned user and records the ban in the database.
- `!unban <userId>` – removes a ban and unbans the user by ID.

The bot re-applies active bans from the database on startup.

## Running

Install dependencies and start the bot:

```
npm install
npm start
```
