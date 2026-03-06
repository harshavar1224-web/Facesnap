const mongoose = require('mongoose');

const FaceEmbeddingSchema = new mongoose.Schema({
    media_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Media', required: true },
    event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    embedding_vector: { type: [Number], required: true }, // Array of floats, typical output of FaceNet (e.g., 512d or 128d)
    bounding_box: { // Optional: useful to know where the face is in the image
        x: Number,
        y: Number,
        w: Number,
        h: Number
    },
    // For video matching
    timestamp: { type: Number, default: null },
    frame_url: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('FaceEmbedding', FaceEmbeddingSchema);
