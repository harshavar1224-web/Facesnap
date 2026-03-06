const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
    name: { type: String, required: true },
    date: { type: Date, required: true },
    location: { type: String, required: true },
    cover_image: { type: String, required: true },
    scans: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 },
    notifications_enabled: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Event', EventSchema);
