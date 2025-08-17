import { motion } from 'framer-motion';
import { Brain, Home, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const HomePage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading } = useAuth();

  const features = [
    {
      icon: Brain,
      title: "IA Adaptativa Avanzada",
      description: "Análisis en tiempo real de evolución anatómica y metabólica",
      color: "text-yellow-400"
    },
    {
      icon: Home,
      title: "Entrenamiento en Casa",
      description: "Modalidad multifuncional con bandas, mancuernas y peso corporal",
      color: "text-yellow-400",
      action: () => navigate('/home-training')
    },
    {
      icon: Camera,
      title: "Corrección por Video IA",
      description: "Análisis de técnica en tiempo real con feedback inmediato",
      color: "text-yellow-400"
    }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-yellow-400 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <div className="container mx-auto px-6 py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            {isAuthenticated ? `¡Bienvenido, ${user?.nombre}!` : 'Entrena con IA'}
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
            {isAuthenticated
              ? 'Tu entrenador personal inteligente está listo para continuar tu transformación.'
              : 'Tu entrenador personal inteligente que adapta rutinas, nutrición y seguimiento automáticamente según tu progreso y objetivos.'
            }
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              onClick={feature.action}
              className={`bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 hover:bg-gray-800/70 transition-colors duration-200 hover:shadow-2xl ${feature.action ? 'cursor-pointer' : ''}`}
            >
              <div className="flex flex-col items-center text-center">
                <div className={`mb-6 p-4 rounded-full bg-gray-700/50 ${feature.color}`}>
                  <feature.icon size={48} />
                </div>
                <h3 className="text-xl font-semibold mb-4 text-white">
                  {feature.title}
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>


      </div>
    </div>
  );
};

export default HomePage;
