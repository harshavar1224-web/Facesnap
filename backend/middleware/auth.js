const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    let token = req.cookies.admin_token;

    // Fallback to Bearer token in headers
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
    }
};

module.exports = authMiddleware;
