import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = () => {
    try {
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('user');

      // Protección extra: si falta userData o no tiene id válido, forzar logout
      if (token && userData) {
        const parsedUser = JSON.parse(userData);
        if (!parsedUser?.id || typeof parsedUser.id !== 'number' || parsedUser.id <= 0) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
          setIsAuthenticated(false);
          return;
        }
        setUser(parsedUser);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } finally {
      setIsLoading(false);
    }
  };

  const login = (userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    try {
      // Intentar notificar al servidor del logout
      const token = localStorage.getItem('token');
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ logoutType: 'manual' })
        }).catch(err => {
          console.warn('No se pudo notificar logout al servidor:', err.message);
        });
      }
    } catch (error) {
      console.warn('Error en logout del servidor:', error);
    }

    // Limpiar datos de autenticación pero preservar algunos datos de rutinas para recovery
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Preservar el methodologyPlanId para recovery posterior (si existe)
    const currentMethodologyPlanId = localStorage.getItem('currentMethodologyPlanId');
    if (currentMethodologyPlanId) {
      localStorage.setItem('lastMethodologyPlanId', currentMethodologyPlanId);
    }
    
    // Limpiar datos sensibles de sesión pero mantener el plan
    localStorage.removeItem('currentRoutineSessionId');
    localStorage.removeItem('currentRoutineSessionStartAt');
    
    setUser(null);
    setIsAuthenticated(false);
    navigate('/login');
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkAuthStatus
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
