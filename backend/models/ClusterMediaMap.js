const mongoose = require('mongoose');

const ClusterMediaMapSchema = new mongoose.Schema({
    cluster_id: { type: mongoose.Schema.Types.ObjectId, ref: 'FaceCluster', required: true },
    event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    media_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Media', required: true },
    timestamp: { type: Number, default: null }, // for videos
    frame_url: { type: String, default: null }, // for videos (thumbnail)
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ClusterMediaMap', ClusterMediaMapSchema);
