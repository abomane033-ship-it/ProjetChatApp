const mongoose = require('mongoose');
module.exports = mongoose.model('Group', {
  name: { type: String, required: true, unique: true },
  members: [String],
  createdAt: { type: Date, default: Date.now }
});
