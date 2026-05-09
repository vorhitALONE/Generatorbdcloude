// auth.js
function requireAuth(req, res, next) {
  if (req.session && req.session.user && req.session.user.username) return next();
  return res.status(401).json({ ok: false, error: "Unauthorized" });
}

module.exports = { requireAuth };
