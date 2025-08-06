# Shroomiess Bot

Discord bot with moderation features.

## Configuration

Create a `.env` file with the following values:

```
DISCORD_BOT_TOKEN=your_bot_token
MONGODB_URI=your_mongodb_connection_string
DB_PASSWORD=your_mongodb_user_password
```

The bot connects to MongoDB to store active bans.

### MongoDB Connections

Mongoose is used for all schema-based operations, such as storing bans. If you need
to interact with MongoDB using the native driver—for example, to test a raw
connection—use `database/mongoClient.js`. This helper requires `DB_PASSWORD` to
be set and exposes a `testMongoConnection()` function that pings the database.

## Commands

- `!ping` – basic ping.
- `!ban @user [reason]` – bans the mentioned user and records the ban in the database.
- `!unban <userId>` – removes a ban and unbans the user by ID.
- `!banExplain` – displays MongoDB execution stats for the ban collection. Restricted to administrators and useful for diagnosing indexing issues.

The bot re-applies active bans from the database on startup.

## Running

Install dependencies and start the bot:

```
npm install
npm start
```
