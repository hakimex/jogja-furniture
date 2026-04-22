/**
 * activityLogger.js — Automatic Activity Audit Middleware
 */
const db = require('../config/database');

const log = async ({ userId, username, role, action, module, description, recordId, recordType, ipAddress }) => {
  try {
    await db.query(
      `INSERT INTO activity_logs (user_id, username, role, action, module, description, record_id, record_type, ip_address)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [userId || null, username || null, role || null, action, module || null,
       description || null, recordId || null, recordType || null, ipAddress || null]
    );
  } catch (err) {
    // Don't throw — logging should never break the main flow
    console.error('ActivityLogger error:', err.message);
  }
};

/**
 * Express middleware factory for auto-logging
 * @param {string} action
 * @param {string} module
 * @param {function} getDescription - optional fn(req,res) => string
 */
const autoLog = (action, module, getDescription) => {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode < 400 && data?.success !== false) {
        const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
        const desc = getDescription ? getDescription(req, data) : null;
        if (req.admin) {
          log({
            userId:     req.admin.id,
            username:   req.admin.username,
            role:       req.admin.role,
            action,
            module,
            description: desc,
            ipAddress:  ip,
          });
        }
      }
      return originalJson(data);
    };
    next();
  };
};

module.exports = { log, autoLog };
