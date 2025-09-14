import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, User, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ErrorPopup from '../ui/ErrorPopup';
import { useAuth } from '../../contexts/AuthContext';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [errorPopup, setErrorPopup] = useState({ show: false, message: '', title: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Limpiar error cuando el usuario empiece a escribir
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email.trim()) {
      newErrors.email = 'El email es requerido';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'El email no es válido';
    }
    
    if (!formData.password.trim()) {
      newErrors.password = 'La contraseña es requerida';
    } else if (formData.password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
    }
    
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorPopup({
          show: true,
          title: 'Error de autenticación',
          message: data.error || 'El email o la contraseña son incorrectos. Por favor, verifica tus credenciales e intenta nuevamente.'
        });
        return;
      }

      // Usar el hook de autenticación para hacer login
      login(data.user, data.token);

      // Redirigir al dashboard o página principal
      navigate('/');

    } catch (error) {
      console.error('Error en login:', error);

      // Si el backend no está disponible, usar credenciales de prueba
      if (formData.email === 'test@test.com' && formData.password === 'password') {
        // Simular usuario de prueba
        const testUser = {
          id: 1,
          nombre: 'Usuario',
          apellido: 'Prueba',
          email: 'test@test.com'
        };
        login(testUser, 'test-token');
        navigate('/');
        return;
      }

      setErrorPopup({
        show: true,
        title: 'Error de conexión',
        message: 'No se pudo conectar con el servidor. Verifica que el backend esté ejecutándose.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        {/* Header con pestañas */}
        <div className="mb-8">
          <div className="flex rounded-xl overflow-hidden border border-yellow-400/20">
            <button className="flex-1 bg-yellow-400 text-[#0b1220] py-3 px-6 font-semibold flex items-center justify-center gap-2 transition-colors">
              <User size={18} />
              Iniciar Sesión
            </button>
            <button
              onClick={() => navigate('/register')}
              className="flex-1 bg-[#0d1522] text-gray-300 py-3 px-6 font-semibold hover:bg-yellow-400/10 transition-colors"
            >
              Registrarse
            </button>
          </div>
        </div>

        {/* Formulario de Login */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-[#0d1522] rounded-xl p-6 sm:p-8 border border-yellow-400/20"
        >
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-yellow-300 mb-2">Iniciar Sesión</h2>
            <p className="text-gray-300">Accede a tu cuenta Entrena con IA</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label className="block text-gray-100 font-semibold mb-2">Email</label>
              <div className="relative">
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="tu@email.com"
                  autoComplete="email"
                  className={`w-full bg-gray-700/60 border ${
                    errors.email ? 'border-red-500' : 'border-yellow-400/20'
                  } rounded-lg px-4 py-3 text-gray-100 placeholder-gray-300 focus:outline-none focus:border-yellow-400 transition-colors`}
                />
                {errors.email && (
                  <p className="text-red-400 text-sm mt-1">{errors.email}</p>
                )}
              </div>
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-gray-100 font-semibold mb-2">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Tu contraseña"
                  autoComplete="current-password"
                  className={`w-full bg-gray-700/60 border ${
                    errors.password ? 'border-red-500' : 'border-yellow-400/20'
                  } rounded-lg px-4 py-3 pr-12 text-gray-100 placeholder-gray-300 focus:outline-none focus:border-yellow-400 transition-colors`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-300 hover:text-yellow-400 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
                {errors.password && (
                  <p className="text-red-400 text-sm mt-1">{errors.password}</p>
                )}
              </div>
            </div>

            {/* Botón de Login */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-yellow-400 hover:bg-yellow-300 text-[#0b1220] font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#0b1220] border-t-transparent"></div>
                  Iniciando...
                </>
              ) : (
                <>
                  <Lock size={18} />
                  Iniciar Sesión
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="text-center mt-6">
            <p className="text-gray-300">
              ¿No tienes cuenta?{' '}
              <button
                onClick={() => navigate('/register')}
                className="text-yellow-400 hover:text-yellow-300 font-semibold transition-colors"
              >
                Crear cuenta
              </button>
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* Popup de Error */}
      <ErrorPopup
        show={errorPopup.show}
        title={errorPopup.title}
        message={errorPopup.message}
        onClose={() => setErrorPopup({ show: false, message: '', title: '' })}
      />
    </div>
  );
};

export default LoginPage;
