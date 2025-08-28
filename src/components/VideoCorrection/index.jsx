import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Camera, 
  Image as ImageIcon, 
  Video, 
  Eye,
  Brain,
  Target
} from 'lucide-react';

// Import de los 2 módulos principales
import ImageCorrection from './ImageCorrection';
import VideoAnalysis from './VideoAnalysis';

/**
 * Componente principal de Corrección por IA
 * Separa en 2 métodos principales:
 * 1. Análisis por Imagen - Subir fotos para análisis postural
 * 2. Análisis por Video - Subir videos O usar cámara en vivo
 */
export default function VideoCorrection() {
  const [activeMode, setActiveMode] = useState('image'); // 'image', 'video'

  const modes = [
    {
      id: 'image',
      name: 'Análisis por Imagen',
      icon: <ImageIcon className="w-6 h-6" />,
      description: 'Sube fotos frontales, laterales o posteriores para análisis postural',
      color: 'bg-blue-500 hover:bg-blue-600',
      borderColor: 'border-blue-400/30',
      bgColor: 'bg-blue-400/10',
      features: ['Múltiples ángulos', 'Análisis postural', 'Feedback detallado']
    },
    {
      id: 'video',
      name: 'Análisis por Video',
      icon: <Video className="w-6 h-6" />,
      description: 'Sube un video de tu ejercicio para análisis de movimiento completo',
      color: 'bg-green-500 hover:bg-green-600',
      borderColor: 'border-green-400/30',
      bgColor: 'bg-green-400/10',
      features: ['Rango de movimiento', 'Tempo y ritmo', 'Análisis completo']
    }
  ];

  const currentMode = modes.find(m => m.id === activeMode);

  const renderActiveComponent = () => {
    switch (activeMode) {
      case 'image':
        return <ImageCorrection />;
      case 'video':
        return <VideoAnalysis />;
      default:
        return <ImageCorrection />;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 pb-24">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-yellow-400 to-yellow-200 bg-clip-text text-transparent">
            Corrección por IA
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Elige el método de análisis que mejor se adapte a tus necesidades y recibe feedback personalizado con inteligencia artificial.
          </p>
        </div>

        {/* Selector de Modos */}
        <Card className="bg-black/80 border-gray-700/50 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Target className="w-5 h-5 mr-2 text-yellow-400" />
              Selecciona el Método de Análisis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {modes.map((mode) => (
                <div
                  key={mode.id}
                  className={`relative p-6 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                    activeMode === mode.id
                      ? `${mode.borderColor} ${mode.bgColor} transform scale-105`
                      : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
                  }`}
                  onClick={() => setActiveMode(mode.id)}
                >
                  {/* Badge de activo */}
                  {activeMode === mode.id && (
                    <Badge className="absolute -top-2 -right-2 bg-yellow-500 text-black">
                      Activo
                    </Badge>
                  )}

                  <div className="text-center">
                    <div className={`w-16 h-16 rounded-full ${mode.color} flex items-center justify-center mx-auto mb-4`}>
                      {mode.icon}
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      {mode.name}
                    </h3>
                    <p className="text-gray-400 text-sm mb-4">
                      {mode.description}
                    </p>
                    
                    {/* Features */}
                    <div className="space-y-2">
                      {mode.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center justify-center text-xs text-gray-300">
                          <div className="w-1 h-1 bg-current rounded-full mr-2"></div>
                          {feature}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Botones de acción */}
            <div className="mt-6 flex justify-center">
              <Button
                onClick={() => setActiveMode(activeMode)}
                className={`${currentMode?.color} text-white font-semibold px-8 py-2`}
              >
                <Brain className="w-4 h-4 mr-2" />
                Iniciar {currentMode?.name}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Renderizar componente activo */}
        {renderActiveComponent()}
      </div>
    </div>
  );
}