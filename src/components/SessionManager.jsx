import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import useSessionManagement from '../hooks/useSessionManagement';

const SessionManager = () => {
  const { isAuthenticated } = useAuth();
  
  // El hook maneja automáticamente toda la lógica de sesiones
  useSessionManagement();

  // No necesita renderizar nada
  return null;
};

export default SessionManager;