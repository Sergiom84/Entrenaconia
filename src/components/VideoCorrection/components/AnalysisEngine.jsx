import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Brain, 
  Zap, 
  Target,
  Eye,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserContext } from '@/contexts/UserContext';
import { useVideoAnalysis } from '../contexts/VideoAnalysisContext';
import VoiceFeedback from '../shared/VoiceFeedback';

export default function AnalysisEngine() {
  const { user } = useAuth();
  const { userData } = useUserContext();
  const { speakCorrections, stopSpeaking } = VoiceFeedback();
  
  const {
    selectedExerciseId,
    selectedVideo,
    isAnalyzing,
    setIsAnalyzing,
    isLiveAnalyzing,
    setIsLiveAnalyzing,
    isCameraOn,
    liveVideoRef,
    canvasRef,
    setAnalysisResult,
    setShowResults,
    normalizeVideoAnalysis,
  } = useVideoAnalysis();

  const handleAnalyzeVideo = async () => {
    if (!selectedVideo) {
      alert('Por favor, sube un video para analizar.');
      return;
    }

    setIsAnalyzing(true);
    setShowResults(false);

    try {
      console.log('🎯 Iniciando análisis de video:', selectedVideo.name);
      
      const formData = new FormData();
      formData.append('exerciseId', selectedExerciseId);
      formData.append('frame', selectedVideo.file);
      
      if (userData) {
        formData.append('perfilUsuario', JSON.stringify({
          edad: userData.edad,
          sexo: userData.sexo,
          peso: userData.peso,
          altura: userData.altura,
          nivel_entrenamiento: userData.nivel_entrenamiento,
          limitaciones_fisicas: userData.limitaciones_fisicas || [],
          objetivo_principal: userData.objetivo_principal
        }));
      }

      const response = await fetch('/api/ai/advanced-correction', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Análisis completado:', result);

      const normalizedResult = normalizeVideoAnalysis(result, selectedExerciseId);
      setAnalysisResult(normalizedResult);
      setShowResults(true);

      // Activar feedback por voz si hay correcciones
      if (normalizedResult.corrections?.length > 0) {
        const corrections = normalizedResult.corrections.map(c => c.recommendation).join('. ');
        speakCorrections(corrections);
      }

    } catch (error) {
      console.error('❌ Error en análisis de video:', error);
      
      const errorResult = {
        exercise: selectedExerciseId,
        overall_score: 0,
        risk_level: 'alto',
        corrections: [{
          id: 1,
          aspect: 'Error de Análisis',
          problem: 'No se pudo completar el análisis',
          recommendation: 'Verifica tu conexión e inténtalo de nuevo',
          priority: 'alta',
          confidence: 'baja'
        }],
        summary: `Error: ${error.message}`,
        timestamp: new Date().toISOString(),
        confidence: 'baja',
        metadata: {
          processing_time: '0s',
          model_version: 'error',
          analysis_type: 'error'
        }
      };
      
      setAnalysisResult(errorResult);
      setShowResults(true);
      alert(`Error en el análisis: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const captureFrame = async () => {
    const video = liveVideoRef.current;
    if (!video) return null;
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    return new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.8);
    });
  };

  const handleLiveAnalysis = async () => {
    if (!isCameraOn) {
      alert('Por favor, activa la cámara primero para usar la Corrección IA en Vivo.');
      return;
    }

    setIsLiveAnalyzing(true);
    setShowResults(false);

    try {
      console.log('📸 Capturando frame para análisis en vivo...');
      
      const frameBlob = await captureFrame();
      if (!frameBlob) {
        throw new Error('No se pudo capturar el frame de la cámara');
      }

      const formData = new FormData();
      formData.append('exerciseId', selectedExerciseId);
      formData.append('frame', frameBlob, 'live_frame.jpg');
      
      if (userData) {
        formData.append('perfilUsuario', JSON.stringify({
          edad: userData.edad,
          sexo: userData.sexo,
          peso: userData.peso,
          altura: userData.altura,
          nivel_entrenamiento: userData.nivel_entrenamiento,
          limitaciones_fisicas: userData.limitaciones_fisicas || [],
          objetivo_principal: userData.objetivo_principal
        }));
      }

      const response = await fetch('/api/ai/advanced-correction', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Análisis en vivo completado:', result);

      const normalizedResult = normalizeVideoAnalysis(result, selectedExerciseId);
      setAnalysisResult(normalizedResult);
      setShowResults(true);

      // Activar feedback por voz inmediato para análisis en vivo
      if (normalizedResult.corrections?.length > 0) {
        const corrections = normalizedResult.corrections
          .slice(0, 2) // Solo las primeras 2 correcciones para no saturar
          .map(c => c.recommendation)
          .join('. ');
        speakCorrections(corrections);
      }

    } catch (error) {
      console.error('❌ Error en análisis en vivo:', error);
      
      const errorResult = {
        exercise: selectedExerciseId,
        overall_score: 0,
        risk_level: 'alto',
        corrections: [{
          id: 1,
          aspect: 'Error de Análisis en Vivo',
          problem: 'No se pudo completar el análisis en tiempo real',
          recommendation: 'Verifica la iluminación y posición de la cámara',
          priority: 'alta',
          confidence: 'baja'
        }],
        summary: `Error en análisis en vivo: ${error.message}`,
        timestamp: new Date().toISOString(),
        confidence: 'baja',
        metadata: {
          processing_time: '0s',
          model_version: 'error',
          analysis_type: 'live_error'
        }
      };
      
      setAnalysisResult(errorResult);
      setShowResults(true);
      alert(`Error en análisis en vivo: ${error.message}`);
    } finally {
      setIsLiveAnalyzing(false);
    }
  };

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-white flex items-center gap-2">
          <Brain className="w-5 h-5" />
          Motor de Análisis IA
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Botón de análisis de video */}
          <div className="text-center">
            <Button 
              onClick={handleAnalyzeVideo}
              disabled={!selectedVideo || isAnalyzing || isLiveAnalyzing}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-3 text-lg font-semibold"
              size="lg"
            >
              {isAnalyzing ? (
                <>
                  <Brain className="w-5 h-5 mr-2 animate-spin" />
                  Analizando Video...
                </>
              ) : (
                <>
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Analizar Video con IA
                </>
              )}
            </Button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-600" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-gray-800 px-2 text-gray-400">O</span>
            </div>
          </div>

          {/* Botón de análisis en vivo */}
          <div className="text-center">
            <Button 
              onClick={handleLiveAnalysis}
              disabled={!isCameraOn || isAnalyzing || isLiveAnalyzing}
              className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white px-6 py-2"
              size="lg"
            >
              {isLiveAnalyzing ? (
                <>
                  <Eye className="w-4 h-4 mr-2 animate-pulse" />
                  Analizando en Vivo...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Corrección IA en Vivo
                </>
              )}
            </Button>
          </div>

          {/* Información sobre el análisis */}
          <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Target className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-200">
                <p className="font-medium mb-1">Análisis con IA Avanzada</p>
                <ul className="space-y-1 text-xs text-blue-300">
                  <li>• Detección automática de posturas incorrectas</li>
                  <li>• Análisis personalizado según tu perfil</li>
                  <li>• Feedback por voz en tiempo real</li>
                  <li>• Recomendaciones específicas de mejora</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}