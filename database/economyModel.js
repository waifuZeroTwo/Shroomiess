const mongoose = require('mongoose');

const economySchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  balance: { type: Number, default: 0 },
  lastWork: { type: Date }
});

economySchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Economy', economySchema);
