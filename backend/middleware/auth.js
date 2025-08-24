import jwt from 'jsonwebtoken';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    // Normaliza para que siempre haya req.user.id disponible
    const normalized = {
      ...decoded,
      id: decoded?.userId ?? decoded?.id,
      userId: decoded?.userId ?? decoded?.id,
    };
    req.user = normalized;
    next();
  });
};

export default authenticateToken;
