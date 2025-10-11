import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  RotateCcw,
  Volume2,
  VolumeX 
} from 'lucide-react';
import { useVideoAnalysis } from '../contexts/VideoAnalysisContext';
import AnalysisResult from '../shared/AnalysisResult';
import VoiceFeedback from '../shared/VoiceFeedback';

export default function ResultsDisplay() {
  const {
    analysisResult,
    showResults,
    setShowResults,
    setAnalysisResult,
    isAnalyzing,
    isLiveAnalyzing,
  } = useVideoAnalysis();
  
  const { stopSpeaking, speakCorrections } = VoiceFeedback();

  const handleResetResults = () => {
    setShowResults(false);
    setAnalysisResult(null);
    stopSpeaking();
    console.log('🔄 Resultados reiniciados');
  };

  const handleReplayVoice = () => {
    if (analysisResult?.corrections?.length > 0) {
      const corrections = analysisResult.corrections
        .map(c => c.recommendation)
        .join('. ');
      speakCorrections(corrections);
    }
  };

  const isLoading = isAnalyzing || isLiveAnalyzing;

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Resultados del Análisis
          </CardTitle>
          
          {showResults && !isLoading && (
            <div className="flex gap-2">
              {analysisResult?.corrections?.length > 0 && (
                <Button
                  onClick={handleReplayVoice}
                  variant="outline"
                  size="sm"
                >
                  <Volume2 className="w-4 h-4" />
                </Button>
              )}
              
              <Button
                onClick={handleResetResults}
                variant="outline"
                size="sm"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-300">
              {isAnalyzing ? 'Procesando video...' : 'Analizando imagen en vivo...'}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Esto puede tomar unos segundos
            </p>
          </div>
        ) : showResults && analysisResult ? (
          <div className="space-y-4">
            {/* Componente de resultados existente */}
            <AnalysisResult result={analysisResult} />
            
            {/* Información adicional */}
            <div className="bg-gray-900/50 rounded-lg p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <p className="text-gray-400">Tiempo de análisis</p>
                  <p className="text-white font-medium">
                    {analysisResult.metadata?.processing_time || '2.5s'}
                  </p>
                </div>
                
                <div className="text-center">
                  <p className="text-gray-400">Modelo IA</p>
                  <p className="text-white font-medium">
                    {analysisResult.metadata?.model_version || 'GPT-4'}
                  </p>
                </div>
                
                <div className="text-center">
                  <p className="text-gray-400">Timestamp</p>
                  <p className="text-white font-medium">
                    {new Date(analysisResult.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Consejos adicionales */}
            {analysisResult.corrections?.length > 0 && (
              <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
                <h4 className="text-blue-200 font-medium mb-2">💡 Consejo Pro</h4>
                <p className="text-blue-300 text-sm">
                  Practica las correcciones de una en una. Domina cada aspecto antes de 
                  pasar al siguiente para obtener mejores resultados.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">Sin resultados aún</p>
            <p className="text-sm">
              Sube un video o usa la cámara en vivo para ver el análisis
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}