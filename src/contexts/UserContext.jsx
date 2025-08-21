import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const UserContext = createContext();

export const useUserContext = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUserContext must be used within a UserProvider');
  }
  return context;
};

export const UserProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [userData, setUserData] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // Cargar datos del perfil del usuario
  const loadUserProfile = async (userId) => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const profileData = await response.json();
        setUserData(profileData);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Actualizar datos del perfil
  const updateUserProfile = async (updates) => {
    if (!user?.id) return false;
    
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        const updatedData = await response.json();
        setUserData(prev => ({ ...prev, ...updatedData }));
        return true;
      }
    } catch (error) {
      console.error('Error updating user profile:', error);
    }
    return false;
  };

  // Cargar perfil cuando el usuario se autentica
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      loadUserProfile(user.id);
    } else {
      setUserData({});
    }
  }, [isAuthenticated, user?.id]);

  const value = {
    userData,
    setUserData,
    isLoading,
    loadUserProfile,
    updateUserProfile
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};
