/**
 * roleCheck.js — Role-Based Access Control Middleware
 * Jogja Furniture Enterprise v2
 */

/**
 * Middleware factory: allow only specific roles
 * Usage: router.get('/path', roleCheck(['superadmin', 'admin_website']), handler)
 */
const roleCheck = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Login diperlukan' });
    }
    if (!allowedRoles.includes(req.admin.role)) {
      return res.status(403).json({
        success: false,
        message: `Akses ditolak. Role '${req.admin.role}' tidak memiliki izin untuk fitur ini.`,
        required_roles: allowedRoles,
      });
    }
    next();
  };
};

// Pre-built role combinations
roleCheck.superadminOnly   = roleCheck(['superadmin']);
roleCheck.warehouseAccess  = roleCheck(['superadmin', 'admin_gudang']);
roleCheck.websiteAccess    = roleCheck(['superadmin', 'admin_website']);
roleCheck.marketingAccess  = roleCheck(['superadmin', 'marketing']);
roleCheck.staffAccess      = roleCheck(['superadmin', 'admin_gudang', 'admin_website', 'marketing']);
roleCheck.gudangOrMarketing= roleCheck(['superadmin', 'admin_gudang', 'marketing']);

module.exports = roleCheck;
