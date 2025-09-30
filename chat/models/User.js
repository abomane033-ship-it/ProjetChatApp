const mongoose = require('mongoose');
module.exports = mongoose.model('User', {
    name: {type: String, required: true, unique: true},
    socketId: String,
    status: {type: String, default: 'offline'}
});