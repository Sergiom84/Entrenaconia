import React, { useState, useEffect } from 'react';
import { X, Info, CheckCircle, AlertTriangle, Target, Loader } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ExerciseInfoModal = ({ show, exercise, onClose }) => {
  const [exerciseInfo, setExerciseInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!show || !exercise) return null;

  // Debug: Ver qué datos tiene el ejercicio
  console.log('🔍 DEBUG ExerciseInfoModal - exercise:', exercise);
  console.log('🔍 DEBUG ExerciseInfoModal - informacion_detallada:', exercise.informacion_detallada);
  console.log('🔍 DEBUG ExerciseInfoModal - keys:', Object.keys(exercise));

  // Función para obtener información de ejercicio desde IA
  const fetchExerciseInfoFromAI = async (exerciseName) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      const response = await fetch('/api/ia-home-training/exercise-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ exerciseName })
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success && data.exerciseInfo) {
        setExerciseInfo({
          ...data.exerciseInfo,
          // Metadatos adicionales para mostrar al usuario
          _metadata: {
            fromDatabase: data.fromDatabase,
            usageCount: data.usageCount,
            newlyGenerated: data.newlyGenerated
          }
        });
        
        // Log para desarrollo
        if (data.fromDatabase) {
          console.log(`💾 Información cargada desde BD (usado ${data.usageCount} veces)`);
        } else {
          console.log('🤖 Nueva información generada por IA y guardada en BD');
        }
      } else {
        throw new Error('No se pudo obtener información del ejercicio');
      }
    } catch (err) {
      console.error('❌ Error fetching exercise info:', err);
      setError(err.message);
      // Proporcionar información por defecto en caso de error
      setExerciseInfo({
        ejecucion: "Información de ejecución no disponible temporalmente.",
        consejos: "Consejos no disponibles temporalmente.",
        errores_evitar: "Errores comunes no disponibles temporalmente."
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Efecto para cargar información del ejercicio
  useEffect(() => {
    if (!show || !exercise) return;

    // Extraer información del ejercicio (puede venir de diferentes campos según el origen)
    const staticInfo = exercise.informacion_detallada || exercise.info_detallada || exercise.detailed_info;
    
    if (staticInfo && staticInfo.ejecucion && staticInfo.consejos && staticInfo.errores_evitar) {
      // Si ya tenemos información completa, usarla
      setExerciseInfo(staticInfo);
    } else if (exercise.ejecucion || exercise.consejos || exercise.errores_evitar) {
      // Si tenemos información parcial, crear objeto
      setExerciseInfo({
        ejecucion: exercise.ejecucion || exercise.execution || "Información de ejecución no disponible.",
        consejos: exercise.consejos || exercise.tips || "Consejos no disponibles.",
        errores_evitar: exercise.errores_evitar || exercise.mistakes_to_avoid || exercise.common_mistakes || "Errores comunes no especificados."
      });
    } else {
      // Si no tenemos información, consultarla a la IA
      fetchExerciseInfoFromAI(exercise.nombre);
    }
  }, [show, exercise]);

  const tabs = [
    {
      id: 'execution',
      label: 'Ejecución',
      icon: Target,
      content: exerciseInfo?.ejecucion || "Información de ejecución no disponible.",
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10'
    },
    {
      id: 'tips',
      label: 'Consejos',
      icon: CheckCircle,
      content: exerciseInfo?.consejos || "Consejos no disponibles.",
      color: 'text-green-400',
      bgColor: 'bg-green-500/10'
    },
    {
      id: 'mistakes',
      label: 'Errores a Evitar',
      icon: AlertTriangle,
      content: exerciseInfo?.errores_evitar || "Errores comunes no especificados.",
      color: 'text-red-400',
      bgColor: 'bg-red-500/10'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-600 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center">
              <Info size={20} className="text-black" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Información del Ejercicio</h3>
              <p className="text-sm text-gray-400 mt-1">{exercise.nombre}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content with Tabs */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-4">
                <Loader size={32} className="text-blue-400 animate-spin" />
                <p className="text-gray-300">Generando información detallada del ejercicio...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-400/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={18} className="text-red-400" />
                <h4 className="font-semibold text-white">Error</h4>
              </div>
              <p className="text-red-300">{error}</p>
            </div>
          ) : (
            <Tabs defaultValue="execution" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-gray-700/50">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="flex items-center gap-2 data-[state=active]:bg-gray-600 data-[state=active]:text-white"
                    >
                      <Icon size={16} className={tab.color} />
                      {tab.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsContent key={tab.id} value={tab.id} className="mt-6">
                    <div className={`${tab.bgColor} border-l-4 border-l-${tab.color.split('-')[1]}-400 rounded-lg p-4`}>
                      <div className="flex items-center gap-2 mb-3">
                        <Icon size={18} className={tab.color} />
                        <h4 className="font-semibold text-white">{tab.label}</h4>
                      </div>
                      <div className="text-gray-300 leading-relaxed">
                        {/* Dividir el contenido por líneas para mejor legibilidad */}
                        {tab.content.split('\n').map((line, index) => (
                          <p key={index} className="mb-2 last:mb-0">
                            {line.trim()}
                          </p>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Cerrar
            </button>
            <div className="flex-1 text-center py-3">
              {exerciseInfo?._metadata ? (
                <div className="text-xs text-gray-400 space-y-1">
                  {exerciseInfo._metadata.fromDatabase ? (
                    <p className="flex items-center justify-center gap-1">
                      <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                      Información reutilizada ({exerciseInfo._metadata.usageCount} usos)
                    </p>
                  ) : (
                    <p className="flex items-center justify-center gap-1">
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                      Nueva información generada por IA
                    </p>
                  )}
                  <p>💡 Esta información te ayudará a realizar el ejercicio correctamente</p>
                </div>
              ) : (
                <p className="text-xs text-gray-400">
                  💡 Esta información te ayudará a realizar el ejercicio correctamente
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExerciseInfoModal;