const mongoose = require('mongoose');

const customCommandSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['prefix', 'slash'], default: 'prefix' },
  response: { type: String, required: true },
  placeholders: [{ type: String }],
  roles: [{ type: String }]
});

customCommandSchema.index({ guildId: 1, name: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('CustomCommand', customCommandSchema);
