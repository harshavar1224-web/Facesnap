const mongoose = require('mongoose');

const MediaSchema = new mongoose.Schema({
    event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    media_type: { type: String, enum: ['photo', 'video'], required: true },
    url: { type: String, required: true }, // Could be S3 / R2 URL
    detected_faces: { type: Number, default: 0 }, // Number of faces detected mapped to this media
    status: { type: String, enum: ['ready', 'processing', 'failed'], default: 'ready' },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Media', MediaSchema);
