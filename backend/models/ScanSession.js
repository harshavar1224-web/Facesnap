const mongoose = require('mongoose');

const ScanSessionSchema = new mongoose.Schema({
    event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    email: { type: String, required: true },
    phone: { type: String, default: null },
    embedding_vector: { type: [Number], required: true },
    cluster_id: { type: mongoose.Schema.Types.ObjectId, ref: 'FaceCluster', default: null },
    notified: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ScanSession', ScanSessionSchema);
