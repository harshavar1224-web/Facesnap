const mongoose = require('mongoose');

const FaceClusterSchema = new mongoose.Schema({
    event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    cluster_id: { type: Number, required: true },
    representative_embedding: { type: [Number], required: true },
    total_media_matches: { type: Number, default: 0 },
    representative_thumbnail: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('FaceCluster', FaceClusterSchema);
