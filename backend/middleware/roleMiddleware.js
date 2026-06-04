// This checks if the logged in user has the required role
const checkRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `❌ Access denied — this action requires one of these roles: ${roles.join(', ')}`
      });
    }
    next();
  };
};

module.exports = checkRole;