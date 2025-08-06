const mongoose = require('mongoose');

const banSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  reason: { type: String },
  expiresAt: { type: Date }
});

banSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Ban', banSchema);
