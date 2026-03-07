const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const nodemailer = require('nodemailer');
const { S3Client } = require('@aws-sdk/client-s3');
const multerS3 = require('multer-s3');

const Event = require('../models/Event');
const Media = require('../models/Media');
const FaceEmbedding = require('../models/FaceEmbedding');
const FaceCluster = require('../models/FaceCluster');
const ClusterMediaMap = require('../models/ClusterMediaMap');
const ScanSession = require('../models/ScanSession');

const router = express.Router();

// Ensure local uploads folder exists as fallback
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Check for Cloud Storage Configuration
const useCloudStorage = !!process.env.STORAGE_BUCKET;

let s3Client;
let upload;

if (useCloudStorage) {
    s3Client = new S3Client({
        region: process.env.STORAGE_REGION || 'auto',
        endpoint: process.env.STORAGE_ENDPOINT, // e.g., Cloudflare R2 endpoint
        credentials: {
            accessKeyId: process.env.STORAGE_ACCESS_KEY,
            secretAccessKey: process.env.STORAGE_SECRET_KEY,
        },
    });

    upload = multer({
        storage: multerS3({
            s3: s3Client,
            bucket: process.env.STORAGE_BUCKET,
            acl: 'public-read',
            metadata: function (req, file, cb) {
                cb(null, { fieldName: file.fieldname });
            },
            key: function (req, file, cb) {
                cb(null, `uploads/${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`);
            }
        })
    });
    console.log("☁️ Configured Cloud Storage for Uploads");
} else {
    // Set up local multer storage
    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, uploadDir)
        },
        filename: function (req, file, cb) {
            cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
        }
    });
    upload = multer({ storage: storage });
    console.log("📂 Configured Local Storage for Uploads");
}

const AI_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

const Admin = require('../models/Admin');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const authMiddleware = require('../middleware/auth');

// Note: To make an initial admin, create one directly in Mongo or via a temporary register route

/**
 * Admin Login
 */
router.post('/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // TEMPORARY: Allow hardcoded default admin if db is empty for demo purposes
        let admin = await Admin.findOne({ email });
        if (!admin && email === 'host@mediaclub.com' && password === 'admin123') {
            const salt = await bcrypt.genSalt(10);
            const hashed = await bcrypt.hash(password, salt);
            admin = new Admin({ email, password: hashed });
            await admin.save();
        }

        if (!admin) return res.status(400).json({ success: false, error: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) return res.status(400).json({ success: false, error: 'Invalid credentials' });

        const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET || 'supersecretkey', { expiresIn: '1d' });

        res.cookie('admin_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });

        res.json({ success: true, token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/admin/logout', (req, res) => {
    res.clearCookie('admin_token');
    res.json({ success: true });
});

/**
 * 1. Create Event (Protected)
 */
router.post('/events', authMiddleware, upload.single('coverImage'), async (req, res) => {
    try {
        console.log("POST /events hit! User Token Decoded:", req.admin);
        const { name, date, location, notifications_enabled } = req.body;
        console.log("Creating new event with payload:", req.body);

        let coverImageUrl = 'linear-gradient(135deg, #1e293b, #0f172a)'; // default

        if (req.file) {
            coverImageUrl = req.file.location ? req.file.location : `/uploads/${req.file.filename}`;
            console.log("Uploaded cover image:", coverImageUrl);
        } else if (req.body.coverImage || req.body.cover_image) {
            coverImageUrl = req.body.coverImage || req.body.cover_image;
        }

        const event = new Event({
            name,
            date,
            location,
            coverImage: coverImageUrl,
            notifications_enabled: notifications_enabled === 'true' || notifications_enabled === true,
            createdBy: req.admin?.id
        });
        await event.save();

        console.log("Event created successfully:", event._id);
        res.status(201).json({ success: true, event });
    } catch (err) {
        console.error("Failed to create event:", err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * 2. Get Events (Public - anyone can see events)
 */
router.get('/events', async (req, res) => {
    try {
        const events = await Event.find().sort({ createdAt: -1 });
        res.json({ success: true, events });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 2.1 Toggle Event Notifications (Protected)
 */
router.patch('/events/:eventId/notifications', authMiddleware, async (req, res) => {
    try {
        const { enabled } = req.body;
        const evt = await Event.findByIdAndUpdate(req.params.eventId, { notifications_enabled: enabled }, { new: true });
        res.json({ success: true, notifications_enabled: evt.notifications_enabled });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 2.5 Generate Event Highlight Reel (Admin only)
 */
router.post('/events/highlight/:eventId', authMiddleware, async (req, res) => {
    try {
        const eventId = req.params.eventId;

        // Get all videos for event
        const videos = await Media.find({ event_id: eventId, media_type: 'video', status: 'ready' });

        if (videos.length === 0) {
            return res.status(400).json({ error: "No ready videos found for this event to create a highlight reel." });
        }

        // Get absolute local paths or direct cloud URLs
        const videoPaths = videos.map(v => {
            if (v.url.startsWith('http')) return v.url;
            return path.join(__dirname, '..', v.url);
        });
        const hasCloudUrls = videoPaths.some(v => v.startsWith('http'));

        const outputFilename = `highlight_${eventId}_${Date.now()}.mp4`;
        const outputPath = path.join(uploadDir, outputFilename);

        const payload = {
            video_paths: videoPaths,
            output_path: outputPath,
            target_duration: 30,
            is_url: hasCloudUrls
        };

        const aiRes = await axios.post(`${AI_URL}/generate_highlight`, payload);

        if (aiRes.data.success) {
            // Save as an event media or just return URL. For now, let's just create a new Media doc for the highlight reel
            const highlightMedia = new Media({
                event_id: eventId,
                media_type: 'video',
                url: aiRes.data.output_url,
                detected_faces: 0,
                status: 'ready'
            });
            await highlightMedia.save();

            res.json({ success: true, url: aiRes.data.output_url, message: `Created highlight reel from ${aiRes.data.clips_combined} clips!` });
        } else {
            res.status(500).json({ error: "AI highlight generation failed" });
        }

    } catch (err) {
        console.error("Highlight Generate Error:", err.message);
        res.status(500).json({ error: err.message || "Failed to generate highlight reel" });
    }
});

/**
 * 3. Upload Media for an Event & Extract Faces via Python API (Protected)
 */
router.post('/upload/:eventId', authMiddleware, upload.array('files', 10), async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const files = req.files;

        let processedCount = 0;
        let facesCount = 0;

        for (const file of files) {
            // Check if file is image or video
            const ext = path.extname(file.originalname).toLowerCase();
            const mediaType = ['.mp4', '.mov', '.avi'].includes(ext) ? 'video' : 'photo';

            // Create media object
            // Use the cloud Location if available, else local path
            const mediaUrl = file.location ? file.location : `/uploads/${file.filename}`;

            const media = new Media({
                event_id: eventId,
                media_type: mediaType,
                url: mediaUrl,
                detected_faces: 0,
                status: mediaType === 'video' ? 'processing' : 'ready'
            });
            await media.save();

            if (mediaType === 'photo') {
                try {
                    let aiRes;

                    if (useCloudStorage) {
                        // If file is in cloud, we can either:
                        // 1. Download it briefly to send to AI
                        // 2. Enhance AI service to download from URL endpoint.
                        // For compatibility and ease, we download a stream directly from S3 to pipe to our AI container
                        const filePath = file.location;

                        // Let's use string URL and alter AI service if needed, OR we can fetch and buffer
                        const imageBufferRes = await axios.get(filePath, { responseType: 'arraybuffer' });

                        const formData = new FormData();
                        formData.append('file', Buffer.from(imageBufferRes.data), file.originalname || 'upload.jpg');

                        aiRes = await axios.post(`${AI_URL}/extract`, formData, {
                            headers: formData.getHeaders(),
                        });

                    } else {
                        // Local path
                        const formData = new FormData();
                        formData.append('file', fs.createReadStream(file.path));

                        aiRes = await axios.post(`${AI_URL}/extract`, formData, {
                            headers: formData.getHeaders(),
                        });
                    }

                    const data = aiRes.data;
                    const faces = data.faces || [];

                    media.detected_faces = faces.length;
                    await media.save();

                    // Save embeddings to Mongo
                    for (const f of faces) {
                        const embedding = new FaceEmbedding({
                            media_id: media._id,
                            event_id: eventId,
                            embedding_vector: f.embedding,
                            bounding_box: f.box
                        });
                        await embedding.save();
                        facesCount++;
                    }

                } catch (err) {
                    console.error("AI Extractor failed for file:", file.originalname, err.message);
                }
            } else if (mediaType === 'video') {
                // Async background processing for videos
                processVideoBackground(media._id, eventId, file, useCloudStorage);
            }

            processedCount++;
        }

        if (facesCount > 0) {
            // Background clustering for immediate photo uploads
            runEventClustering(eventId);
        } else {
            // Even if no faces, we might need to trigger notifications for previously clustered? Not needed if no faces.
        }

        res.json({ success: true, files_processed: processedCount, faces_extracted: facesCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Helper fn to process video embeddings without blocking Node thread
 */
async function processVideoBackground(mediaId, eventId, fileObj, isCloud) {
    try {
        let videoPathOrUrl = isCloud ? fileObj.location : path.resolve(fileObj.path);

        // Tell AI tool to fetch or process
        const payload = {
            video_path: videoPathOrUrl,
            output_dir: path.resolve(uploadDir), // where thumbnails map locally. If cloud, need extra step later.
            fps_rate: 1,
            is_url: isCloud
        };

        const aiRes = await axios.post(`${AI_URL}/extract_video`, payload);
        const data = aiRes.data;
        const faces = data.faces || [];

        // Save embeddings
        for (const f of faces) {
            const embedding = new FaceEmbedding({
                media_id: mediaId,
                event_id: eventId,
                embedding_vector: f.embedding,
                bounding_box: f.box,
                timestamp: f.timestamp,
                frame_url: f.thumbnail
            });
            await embedding.save();
        }

        // Mark complete
        await Media.findByIdAndUpdate(mediaId, {
            status: 'ready',
            detected_faces: faces.length
        });

        runEventClustering(eventId);

    } catch (err) {
        console.error("Video processing explicitly failed:", err.message);
        await Media.findByIdAndUpdate(mediaId, { status: 'failed' });
    }
}

/**
 * Helper fn to run clustering in background
 */
async function runEventClustering(eventId) {
    try {
        const embeddings = await FaceEmbedding.find({ event_id: eventId });
        if (embeddings.length === 0) return;

        const payload = {
            embeddings: embeddings.map(e => ({
                id: e._id.toString(),
                embedding: e.embedding_vector
            }))
        };

        const aiRes = await axios.post(`${AI_URL}/cluster`, payload);
        const clustersData = aiRes.data.clusters || [];

        // Clear existing clusters for fresh rebuild
        await FaceCluster.deleteMany({ event_id: eventId });
        await ClusterMediaMap.deleteMany({ event_id: eventId });

        for (const c of clustersData) {
            let thumb = null;
            if (c.items.length > 0) {
                const firstEmb = embeddings.find(e => e._id.toString() === c.items[0]);
                if (firstEmb && firstEmb.frame_url) {
                    thumb = firstEmb.frame_url;
                } else if (firstEmb) {
                    const m = await Media.findById(firstEmb.media_id);
                    if (m) thumb = m.url;
                }
            }

            const faceCluster = new FaceCluster({
                event_id: eventId,
                cluster_id: c.cluster_id,
                representative_embedding: c.representative_embedding,
                total_media_matches: c.items.length,
                representative_thumbnail: thumb
            });
            await faceCluster.save();

            // Insert mappings
            for (const itemId of c.items) {
                const emb = embeddings.find(e => e._id.toString() === itemId);
                if (emb) {
                    const mapItem = new ClusterMediaMap({
                        cluster_id: faceCluster._id,
                        event_id: eventId,
                        media_id: emb.media_id,
                        timestamp: emb.timestamp,
                        frame_url: emb.frame_url
                    });
                    await mapItem.save();
                }
            }
        }

        // Trigger notifications for any unmatched/unnotified sessions
        triggerNotifications(eventId);

    } catch (err) {
        console.error("Clustering failed:", err.message);
    }
}

async function triggerNotifications(eventId) {
    try {
        const event = await Event.findById(eventId);
        if (!event || !event.notifications_enabled) return;

        // Find sessions that haven't been notified yet
        const sessions = await ScanSession.find({ event_id: eventId, notified: false, email: { $ne: null } });
        if (sessions.length === 0) return;

        const clusters = await FaceCluster.find({ event_id: eventId });

        // Setup Ethereal for testing
        let testAccount = await nodemailer.createTestAccount();
        let transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });

        for (const session of sessions) {
            let bestCluster = null;
            let bestDistance = 1.0;
            const threshold = 0.35;

            for (const cl of clusters) {
                const targetVec = cl.representative_embedding;
                let dotProduct = 0;
                let normA = 0;
                let normB = 0;
                for (let i = 0; i < session.embedding_vector.length; i++) {
                    dotProduct += session.embedding_vector[i] * targetVec[i];
                    normA += session.embedding_vector[i] * session.embedding_vector[i];
                    normB += targetVec[i] * targetVec[i];
                }
                const distance = 1 - (dotProduct / (Math.sqrt(normA) * Math.sqrt(normB)));

                if (distance < threshold && distance < bestDistance) {
                    bestCluster = cl;
                    bestDistance = distance;
                }
            }

            if (bestCluster) {
                const mappings = await ClusterMediaMap.find({ cluster_id: bestCluster._id }).populate('media_id');
                const uniquePhotos = new Set();
                const uniqueVideos = new Set();

                for (const mObj of mappings) {
                    if (!mObj.media_id) continue;
                    if (mObj.media_id.media_type === 'photo') uniquePhotos.add(mObj.media_id._id.toString());
                    if (mObj.media_id.media_type === 'video') uniqueVideos.add(mObj.media_id._id.toString() + '_' + mObj.timestamp);
                }

                if (uniquePhotos.size > 0 || uniqueVideos.size > 0) {
                    // Send Email
                    const galleryLink = `http://localhost:5173/gallery/${eventId}?sessionId=${session._id}`; // use real origin in prod

                    let info = await transporter.sendMail({
                        from: '"Media Club" <noreply@mediaclub.app>',
                        to: session.email,
                        subject: `Your photos from ${event.name} are ready!`,
                        html: `
                            <div style="font-family: Arial, sans-serif; max-w-md; margin: 0 auto; padding: 20px; color: #333;">
                                <h2>Hi there,</h2>
                                <p>We found <strong>${uniquePhotos.size}</strong> photos and <strong>${uniqueVideos.size}</strong> video moments where you appear.</p>
                                <p>View and download your media securely via the link below:</p>
                                <a href="${galleryLink}" style="display: inline-block; padding: 12px 24px; background-color: #5B8CFF; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">View My Gallery</a>
                                <p style="margin-top: 30px; font-size: 12px; color: #888;">If you did not request this, please ignore this email.</p>
                            </div>
                        `,
                    });

                    console.log(`Notification sent to ${session.email}. Preview: ${nodemailer.getTestMessageUrl(info)}`);

                    // Update session
                    session.cluster_id = bestCluster._id;
                    session.notified = true;
                    await session.save();
                }
            }
        }
    } catch (err) {
        console.error("Trigger Notifications Error:", err);
    }
}

/**
 * 4. Scan Face Endpoint
 * Receives the blob/image from webcam, gets embedding from AI, and finds matching media
 */
router.post('/scan/:eventId', upload.single('face'), async (req, res) => {
    try {
        const eventId = req.params.eventId;
        if (!req.file) return res.status(400).json({ error: "Missing face image" });

        // 1. Get Source Embedding from AI
        const formData = new FormData();
        formData.append('file', fs.createReadStream(req.file.path));

        const extractRes = await axios.post(`${AI_URL}/extract`, formData, {
            headers: formData.getHeaders(),
        });

        const email = req.body.email || null;
        const phone = req.body.phone || null;

        const faces = extractRes.data.faces;
        if (!faces || faces.length === 0) {
            fs.unlinkSync(req.file.path); // remove tmp file
            return res.status(400).json({ error: "No face detected in the scanned image." });
        }

        const sourceEmbedding = faces[0].embedding; // Use the main face

        // 2. Optimized Cluster Search
        const clusters = await FaceCluster.find({ event_id: eventId });
        let bestCluster = null;
        let bestDistance = 1.0;
        const threshold = 0.35;

        for (const cl of clusters) {
            const targetVec = cl.representative_embedding;
            let dotProduct = 0;
            let normA = 0;
            let normB = 0;
            for (let i = 0; i < sourceEmbedding.length; i++) {
                dotProduct += sourceEmbedding[i] * targetVec[i];
                normA += sourceEmbedding[i] * sourceEmbedding[i];
                normB += targetVec[i] * targetVec[i];
            }
            const distance = 1 - (dotProduct / (Math.sqrt(normA) * Math.sqrt(normB)));

            if (distance < threshold && distance < bestDistance) {
                bestCluster = cl;
                bestDistance = distance;
            }
        }

        fs.unlinkSync(req.file.path);

        let matchedMediaObjects = [];

        // Fetch media for the best cluster
        if (bestCluster) {
            const mappings = await ClusterMediaMap.find({ cluster_id: bestCluster._id }).populate('media_id');
            let matchingMediaSet = new Set();

            for (const mObj of mappings) {
                const mediaDoc = mObj.media_id;
                if (!mediaDoc) continue;

                const mIdStr = mediaDoc._id.toString();
                let existingMatch = matchedMediaObjects.find(m => m._id.toString() === mIdStr);

                if (!existingMatch) {
                    existingMatch = {
                        ...mediaDoc.toObject(),
                        video_matches: []
                    };
                    matchedMediaObjects.push(existingMatch);
                    matchingMediaSet.add(mIdStr);
                }

                if (mediaDoc.media_type === 'video' && mObj.timestamp !== null) {
                    const isDup = existingMatch.video_matches.some(v => Math.abs(v.timestamp - mObj.timestamp) < 1.0);
                    if (!isDup) {
                        existingMatch.video_matches.push({
                            timestamp: mObj.timestamp,
                            thumbnail: mObj.frame_url,
                            distance: bestDistance
                        });
                    }
                }
            }
        }

        // Sort video_matches by timestamp
        matchedMediaObjects.forEach(m => {
            if (m.video_matches) {
                m.video_matches.sort((a, b) => a.timestamp - b.timestamp);
            }
        });

        // Track ScanSession and link cluster
        let sessionObj = null;
        if (email) {
            sessionObj = new ScanSession({
                event_id: eventId,
                email: email,
                phone: phone,
                embedding_vector: sourceEmbedding,
                cluster_id: bestCluster ? bestCluster._id : null,
                notified: true // they are viewing right now, so mark notified
            });
            await sessionObj.save();
        }

        // Track scan metric
        await Event.findByIdAndUpdate(eventId, { $inc: { scans: 1 } });

        res.json({ success: true, matches: matchedMediaObjects, distance_threshold: threshold, sessionId: sessionObj ? sessionObj._id : null });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * 5. Download All Matches (ZIP)
 */
const archiver = require('archiver');

router.post('/download-all', async (req, res) => {
    try {
        const { mediaIds } = req.body;
        if (!mediaIds || mediaIds.length === 0) {
            return res.status(400).json({ error: "No media IDs provided" });
        }

        const medias = await Media.find({ _id: { $in: mediaIds } });
        if (medias.length === 0) {
            return res.status(404).json({ error: "Media not found" });
        }

        res.writeHead(200, {
            'Content-Type': 'application/zip',
            'Content-Disposition': 'attachment; filename="MediaClub_Matched_Photos.zip"'
        });

        const archive = archiver('zip', {
            zlib: { level: 9 }
        });

        archive.on('error', err => {
            throw err;
        });

        archive.pipe(res);

        for (const media of medias) {
            if (media.url.startsWith('http')) {
                // Cloud URL - We must stream it to the archive
                try {
                    const response = await axios({
                        method: 'get',
                        url: media.url,
                        responseType: 'stream'
                    });
                    archive.append(response.data, { name: path.basename(new URL(media.url).pathname) });
                } catch (e) {
                    console.error("Failed fetching external media for zip:", media.url);
                }
            } else {
                // Local Path
                const localPath = path.join(__dirname, '..', media.url);
                if (fs.existsSync(localPath)) {
                    archive.file(localPath, { name: path.basename(localPath) });
                }
            }
        }

        archive.finalize();

        // Increment event download metrics based on event IDs derived from media
        const eventIds = new Set(medias.map(m => m.event_id.toString()));
        for (const eId of eventIds) {
            await Event.findByIdAndUpdate(eId, { $inc: { downloads: 1 } });
        }

    } catch (err) {
        console.error("ZIP Generation Error:", err);
        // If we already sent headers this might crash, but archiver throws errors mostly.
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
});

/**
 * 6. Track single download trigger
 */
router.get('/track/download/:eventId', async (req, res) => {
    try {
        await Event.findByIdAndUpdate(req.params.eventId, { $inc: { downloads: 1 } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 6.5 Send Email Notification
 */
router.post('/send-notification', async (req, res) => {
    try {
        const { email, eventName, galleryLink, photoCount, videoCount } = req.body;

        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }

        // Use Ethereal for testing/dev, or real SMTP for production
        // Here we'll dynamically create a test account for demo purposes
        let testAccount = await nodemailer.createTestAccount();

        let transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: testAccount.user, // generated ethereal user
                pass: testAccount.pass, // generated ethereal password
            },
        });

        // Send mail with defined transport object
        let info = await transporter.sendMail({
            from: '"Media Club" <noreply@mediaclub.app>',
            to: email,
            subject: `Your photos from ${eventName} are ready!`,
            html: `
                <div style="font-family: Arial, sans-serif; max-w-md; margin: 0 auto; padding: 20px; color: #333;">
                    <h2>Hi there,</h2>
                    <p>We found <strong>${photoCount}</strong> photos and <strong>${videoCount}</strong> video moments where you appear.</p>
                    <p>View and download your media securely via the link below:</p>
                    <a href="${galleryLink}" style="display: inline-block; padding: 12px 24px; background-color: #5B8CFF; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">View My Gallery</a>
                    <p style="margin-top: 30px; font-size: 12px; color: #888;">If you did not request this, please ignore this email.</p>
                </div>
            `,
        });

        res.json({
            success: true,
            previewUrl: nodemailer.getTestMessageUrl(info)
        });

    } catch (err) {
        console.error("Email Error:", err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * 7. Admin Analytics Dashboard Data (Protected)
 */
router.get('/admin/analytics', authMiddleware, async (req, res) => {
    try {
        const totalEvents = await Event.countDocuments();
        const totalMedia = await Media.countDocuments();
        const totalAdmins = await Admin.countDocuments();

        // Sum scans and downloads using aggregate
        const eventSums = await Event.aggregate([
            { $group: { _id: null, totalScans: { $sum: "$scans" }, totalDownloads: { $sum: "$downloads" } } }
        ]);

        const totalScans = eventSums[0]?.totalScans || 0;
        const totalDownloads = eventSums[0]?.totalDownloads || 0;

        res.json({
            success: true,
            analytics: {
                totalEvents,
                totalMedia,
                totalScans,
                totalDownloads,
                totalAdmins
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * 8. Admin Event Stats (Protected)
 */
router.get('/admin/events/stats', authMiddleware, async (req, res) => {
    try {
        const eventsDb = await Event.find().sort({ createdAt: -1 });

        const stats = await Promise.all(eventsDb.map(async evt => {
            const photoCount = await Media.countDocuments({ event_id: evt._id, media_type: 'photo' });
            const videoCount = await Media.countDocuments({ event_id: evt._id, media_type: 'video' });
            const processingCount = await Media.countDocuments({ event_id: evt._id, status: 'processing' });
            const participantsCount = await FaceCluster.countDocuments({ event_id: evt._id });

            return {
                _id: evt._id,
                name: evt.name,
                scans: evt.scans || 0,
                downloads: evt.downloads || 0,
                photos: photoCount,
                videos: videoCount,
                processing: processingCount,
                participants: participantsCount,
                notifications_enabled: evt.notifications_enabled || false,
                createdAt: evt.createdAt
            }
        }));

        res.json({ success: true, stats });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serve static uploads
router.use('/uploads', express.static(uploadDir));

module.exports = router;
