const mongoose = require('mongoose');
module.exports = mongoose.model('Message', {
  conv: String,
  username: String,
  message: String,
  timestamp: { type: Date, default: Date.now },
  type: { type: String, default: 'text' },
  file: {
    name: String,
    path: String
  }
});
