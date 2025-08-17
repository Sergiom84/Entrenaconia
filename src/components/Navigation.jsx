import { motion } from 'framer-motion';
import { LogOut, User, Home, Dumbbell, UserCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Navigation = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return null; // No mostrar navegación si no está autenticado
  }

  const handleLogout = () => {
    if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
      logout();
    }
  };

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-[#0d1522] border-b border-yellow-400/20 sticky top-0 z-50"
    >
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div 
            onClick={() => navigate('/')}
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="bg-yellow-400 p-2 rounded-lg">
              <Dumbbell size={24} className="text-[#0b1220]" />
            </div>
            <h1 className="text-xl font-bold text-white">Entrena con IA</h1>
          </div>

          {/* Navegación central */}
          <div className="hidden md:flex items-center gap-6">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-gray-300 hover:text-yellow-400 transition-colors font-medium"
            >
              <Home size={18} />
              Inicio
            </button>
            <button
              onClick={() => navigate('/home-training')}
              className="flex items-center gap-2 text-gray-300 hover:text-yellow-400 transition-colors font-medium"
            >
              <Dumbbell size={18} />
              Entrenar
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="flex items-center gap-2 text-gray-300 hover:text-yellow-400 transition-colors font-medium"
            >
              <UserCircle size={18} />
              Perfil
            </button>
          </div>

          {/* Usuario y logout */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-gray-300">
              <User size={18} />
              <span className="font-medium">
                {user?.nombre} {user?.apellido}
              </span>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Cerrar Sesión</span>
            </button>
          </div>
        </div>

        {/* Navegación móvil */}
        <div className="md:hidden flex justify-center gap-6 mt-4 pt-4 border-t border-yellow-400/20">
          <button
            onClick={() => navigate('/')}
            className="flex flex-col items-center gap-1 text-gray-300 hover:text-yellow-400 transition-colors"
          >
            <Home size={20} />
            <span className="text-xs">Inicio</span>
          </button>
          <button
            onClick={() => navigate('/home-training')}
            className="flex flex-col items-center gap-1 text-gray-300 hover:text-yellow-400 transition-colors"
          >
            <Dumbbell size={20} />
            <span className="text-xs">Entrenar</span>
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="flex flex-col items-center gap-1 text-gray-300 hover:text-yellow-400 transition-colors"
          >
            <UserCircle size={20} />
            <span className="text-xs">Perfil</span>
          </button>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navigation;
