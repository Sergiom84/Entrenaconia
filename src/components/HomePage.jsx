import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Importaciones de componentes de UI e iconos necesarios
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Brain, Smartphone, Camera } from 'lucide-react';

const HomePage = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-yellow-400 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden pt-24 pb-24">
      {/* Animated background effect */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          background: `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, yellow 0%, transparent 50%)`
        }}
      />

      {/* Hero Section */}
      <div className="relative z-10 pt-20 pb-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-yellow-400 to-yellow-200 bg-clip-text text-transparent">
            MindFit
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Tu entrenador personal inteligente que adapta rutinas, nutrición y seguimiento
            automáticamente según tu progreso y objetivos.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <Card
              className="bg-black/50 border-yellow-400/20 hover:border-yellow-400/40 transition-colors cursor-pointer"
              onClick={() => navigate('/ai-adaptive')}
            >
              <CardHeader>
                <Brain className="w-8 h-8 text-yellow-400 mb-2" />
                <CardTitle className="text-white text-xl font-semibold">IA Adaptativa Avanzada</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400">
                  Análisis en tiempo real de evolución anatómica y metabólica
                </p>
              </CardContent>
            </Card>

            <Card
              className="bg-black/50 border-yellow-400/20 hover:border-yellow-400/40 transition-colors cursor-pointer"
              onClick={() => navigate('/home-training')}
            >
              <CardHeader>
                <Smartphone className="w-8 h-8 text-yellow-400 mb-2" />
                <CardTitle className="text-white text-xl font-semibold">Entrenamiento en Casa</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400">
                  Modalidad multifuncional con bandas, mancuernas y peso corporal
                </p>
              </CardContent>
            </Card>

            <Card
              className="bg-black/50 border-yellow-400/20 hover:border-yellow-400/40 transition-colors cursor-pointer"
              onClick={() => navigate('/video-correction')}
            >
              <CardHeader>
                <Camera className="w-8 h-8 text-yellow-400 mb-2" />
                <CardTitle className="text-white text-xl font-semibold">Corrección por Video IA</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400">
                  Análisis de técnica en tiempo real con feedback inmediato
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
