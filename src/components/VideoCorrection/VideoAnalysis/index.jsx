import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useUserContext } from '@/contexts/UserContext';
import { 
  Video, 
  Upload, 
  Brain, 
  Trash2,
  Clock,
  TrendingUp,
  Target,
  Play,
  Camera,
  Pause,
  Eye,
  RotateCcw,
  Settings,
  Zap
} from 'lucide-react';

import ExerciseSelector from '../shared/ExerciseSelector';
import AnalysisResult from '../shared/AnalysisResult';
import VoiceFeedback from '../shared/VoiceFeedback';

/**
 * Componente de Análisis de Video
 * Permite subir videos para análisis de movimiento completo
 */
export default function VideoAnalysis() {
  const { user } = useAuth();
  const { userData } = useUserContext();
  const { speakCorrections, stopSpeaking } = VoiceFeedback();
  
  const fileInputRef = useRef(null);
  const videoPreviewRef = useRef(null);
  const liveVideoRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedBlobsRef = useRef([]);
  const canvasRef = useRef(null);
  
  const [selectedExerciseId, setSelectedExerciseId] = useState('squat');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [showResults, setShowResults] = useState(false);
  
  // Estados para cámara en vivo
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isLiveAnalyzing, setIsLiveAnalyzing] = useState(false);

  // Normaliza la respuesta del endpoint de video
  const normalizeVideoAnalysis = (payload, fallbackExercise) => {
    try {
      const a = payload?.analysis || {};
      const md = payload?.metadata || {};

      const mapRiskToConfidence = (risk) => {
        const r = String(risk || '').toLowerCase();
        if (r === 'bajo') return 'alta';
        if (r === 'medio' || r === 'media') return 'media';
        if (r === 'alto') return 'baja';
        return 'media';
      };

      const correctionsSrc = Array.isArray(a.correcciones_priorizadas)
        ? a.correcciones_priorizadas
        : (Array.isArray(a.correcciones) ? a.correcciones : []);

      const correcciones = correctionsSrc.map((c) => {
        if (typeof c === 'string') {
          return { prioridad: 'media', accion: c, fundamento: '' };
        }
        return {
          prioridad: c.prioridad || c.importancia || 'media',
          accion: c.accion || c.solucion || c.aspecto || c.descripcion || c.description || '',
          fundamento: c.fundamento || c.problema || c.evidencia || c.evidence || ''
        };
      });

      const feedbackVoz = correcciones
        .map(c => c.accion)
        .filter(Boolean)
        .slice(0, 5);

      return {
        ejercicio: md.exercise_analyzed || fallbackExercise || 'No especificado',
        confianza_global: mapRiskToConfidence(a.nivel_riesgo),
        correcciones_priorizadas: correcciones,
        errores_detectados: Array.isArray(a.errores_detectados) ? a.errores_detectados : [],
        metricas: a.metricas || null,
        puntos_clave: Array.isArray(a.puntos_positivos) ? a.puntos_positivos : (Array.isArray(a.puntos_clave) ? a.puntos_clave : []),
        riesgos_potenciales: Array.isArray(a.riesgos_potenciales) ? a.riesgos_potenciales : (a.nivel_riesgo ? [a.nivel_riesgo] : []),
        siguiente_paso: a.siguiente_paso || a.recomendaciones_adicionales || a.nota_final || '',
        feedback_voz: Array.isArray(a.feedback_voz) ? a.feedback_voz : feedbackVoz,
        overlay_recomendado: Array.isArray(a.overlay_recomendado) ? a.overlay_recomendado : [],
        metadata: {
          timestamp: md.timestamp || new Date().toISOString(),
          model: md.model_used || md.model || 'gpt-4.1-nano',
          videoCount: 1,
          duration: md.duration || selectedVideo?.duration || 0,
          confidence: mapRiskToConfidence(a.nivel_riesgo)
        }
      };
    } catch (e) {
      console.warn('No se pudo normalizar análisis de video, devolviendo payload crudo:', e);
      return payload;
    }
  };

  const handlePickVideo = () => {
    fileInputRef.current?.click();
  };

  const handleVideoSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar que sea un video
    if (!file.type.startsWith('video/')) {
      alert('Por favor, selecciona un archivo de video válido.');
      return;
    }

    // Validar tamaño (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      alert('El archivo es demasiado grande. El tamaño máximo es 50MB.');
      return;
    }

    const url = URL.createObjectURL(file);
    
    // Obtener información del video
    const video = document.createElement('video');
    video.src = url;
    
    const videoInfo = await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        resolve({
          id: Math.random().toString(36),
          name: file.name,
          url: url,
          file: file,
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          size: file.size
        });
      };
    });

    setSelectedVideo(videoInfo);
  };

  const removeVideo = () => {
    if (selectedVideo?.url) {
      URL.revokeObjectURL(selectedVideo.url);
    }
    setSelectedVideo(null);
    setAnalysisResult(null);
    setShowResults(false);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const handleAnalyzeVideo = async () => {
    if (!selectedVideo) {
      alert('Por favor, sube un video para analizar.');
      return;
    }

    if (!user?.id) {
      alert('Necesitas estar autenticado para usar el Análisis IA de Video.');
      return;
    }

    try {
      setIsAnalyzing(true);

      const fd = new FormData();
      fd.append('video', selectedVideo.file, selectedVideo.name);
      fd.append('exercise_name', selectedExerciseId);
      fd.append('exercise_description', '');
      fd.append('user_context', JSON.stringify({
        edad: userData?.edad,
        peso: userData?.peso,
        altura: userData?.altura,
        nivel: userData?.nivel,
        lesiones: userData?.lesiones,
        equipamiento: userData?.equipamiento,
        objetivos: userData?.objetivos,
      }));

      console.log(`🎥 Analizando video: ${selectedVideo.name}`);

      // Llamar a la ruta específica de análisis de video
      const res = await fetch('/api/ai/analyze-video', { method: 'POST', body: fd });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Análisis IA no disponible: ${errorText}`);
      }

      const data = await res.json();
      console.log('Análisis IA de Video (raw):', data);
      const normalized = normalizeVideoAnalysis(data, selectedExerciseId);
      console.log('Análisis IA de Video (normalizado):', normalized);
      
      setAnalysisResult(normalized);
      setShowResults(true);

      // Mostrar mensaje de éxito
      alert('¡Análisis IA de video completado exitosamente! Los resultados se muestran a continuación.');
    } catch (err) {
      console.error('Error en Análisis IA de Video:', err);
      alert(`No se pudo ejecutar el Análisis IA de Video: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Funciones para cámara en vivo
  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Tu navegador no soporta el acceso a la cámara. Usa Chrome, Firefox o Safari moderno.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }, 
        audio: false 
      });
      
      mediaStreamRef.current = stream;
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        await liveVideoRef.current.play();
      }
      setIsCameraOn(true);
    } catch (err) {
      console.error('No se pudo iniciar la cámara:', err);
      let errorMessage = 'No se pudo acceder a la cámara. ';

      if (err.name === 'NotAllowedError') {
        errorMessage += 'Por favor, permite el acceso a la cámara en tu navegador.';
      } else if (err.name === 'NotFoundError') {
        errorMessage += 'No se encontró ninguna cámara disponible.';
      } else if (err.name === 'NotReadableError') {
        errorMessage += 'La cámara está siendo utilizada por otra aplicación.';
      } else {
        errorMessage += `Error: ${err.message}`;
      }

      alert(errorMessage);
    }
  };

  const stopCamera = () => {
    try {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = null;
      }
      setIsCameraOn(false);
      setIsRecording(false);
    } catch (err) {
      console.error('Error al detener la cámara:', err);
    }
  };

  const startRecording = () => {
    try {
      if (!mediaStreamRef.current) {
        alert('Primero debes activar la cámara para poder grabar.');
        return;
      }

      recordedBlobsRef.current = [];
      const stream = mediaStreamRef.current;

      if (!MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        console.warn('Codec vp9,opus no soportado, usando configuración básica');
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
      } else {
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
        mediaRecorderRef.current = recorder;
      }

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedBlobsRef.current.push(e.data);
      };

      mediaRecorderRef.current.start(100);
      setIsRecording(true);
    } catch (err) {
      console.error('No se pudo iniciar la grabación:', err);
      alert('Error al iniciar la grabación: ' + err.message);
    }
  };

  const stopRecording = () => {
    try {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } catch (err) {
      console.error('Error al detener la grabación:', err);
    }
  };

  const downloadRecording = () => {
    if (recordedBlobsRef.current.length === 0) {
      alert('No hay grabación disponible para descargar.');
      return;
    }

    const blob = new Blob(recordedBlobsRef.current, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `entrenamiento-${new Date().toISOString().slice(0, 19)}.webm`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const captureFrame = async () => {
    const video = liveVideoRef.current;
    if (!video) return null;
    const canvas = canvasRef.current;
    if (!canvas) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  };

  const handleLiveAnalysis = async () => {
    if (!isCameraOn) {
      alert('Por favor, activa la cámara primero para usar la Corrección IA en Vivo.');
      return;
    }

    if (!user?.id) {
      alert('Necesitas estar autenticado para usar la Corrección IA en Vivo.');
      return;
    }

    try {
      setIsLiveAnalyzing(true);
      
      const frameBlob = await captureFrame();
      if (!frameBlob) {
        alert('No se pudo capturar el fotograma de la cámara.');
        return;
      }

      const fd = new FormData();
      fd.append('frame', frameBlob, 'frame.jpg');
      fd.append('exerciseId', selectedExerciseId);
      fd.append('userId', user.id);
      fd.append('perfilUsuario', JSON.stringify({
        edad: userData?.edad,
        peso: userData?.peso,
        altura: userData?.altura,
        nivel: userData?.nivel,
        lesiones: userData?.lesiones,
        equipamiento: userData?.equipamiento,
        objetivos: userData?.objetivos,
      }));

      console.log('🎥 Analizando fotograma en vivo...');

      const res = await fetch('/api/ai/advanced-correction', { method: 'POST', body: fd });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`IA avanzada no disponible: ${errorText}`);
      }

      const data = await res.json();
      console.log('Corrección IA en Vivo:', data);
      setAnalysisResult(data);
      setShowResults(true);

      alert('¡Análisis IA en vivo completado! Los resultados se muestran a continuación.');
    } catch (err) {
      console.error('Error en Corrección IA en Vivo:', err);
      alert(`No se pudo ejecutar la Corrección IA en Vivo: ${err.message}`);
    } finally {
      setIsLiveAnalyzing(false);
    }
  };

  // Cleanup cuando el componente se desmonte
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="space-y-8">
      {/* Información del módulo */}
      <Card className="bg-black/80 border-green-400/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Video className="w-5 h-5 mr-2 text-green-400" />
            Análisis por Video
          </CardTitle>
          <CardDescription className="text-gray-400">
            Sube un video de tu ejercicio para obtener un análisis completo de movimiento, tempo y técnica.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="flex items-center space-x-3 p-3 bg-green-500/10 rounded-lg border border-green-400/20">
              <TrendingUp className="w-8 h-8 text-green-400" />
              <div>
                <h4 className="text-white font-medium">Rango de Movimiento</h4>
                <p className="text-gray-400 text-sm">Medición de ángulos</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-green-500/10 rounded-lg border border-green-400/20">
              <Clock className="w-8 h-8 text-green-400" />
              <div>
                <h4 className="text-white font-medium">Tempo y Ritmo</h4>
                <p className="text-gray-400 text-sm">Control excéntrico</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-green-500/10 rounded-lg border border-green-400/20">
              <Target className="w-8 h-8 text-green-400" />
              <div>
                <h4 className="text-white font-medium">Análisis Completo</h4>
                <p className="text-gray-400 text-sm">Feedback detallado</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selector de ejercicio */}
      <ExerciseSelector 
        selectedExerciseId={selectedExerciseId}
        onExerciseChange={setSelectedExerciseId}
      />

      {/* Subida de video */}
      <Card className="bg-black/80 border-green-400/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Upload className="w-5 h-5 mr-2 text-green-400" />
            Subir Video para Análisis
          </CardTitle>
          <CardDescription className="text-gray-400">
            Selecciona un video de tu ejercicio (máximo 50MB, formatos: MP4, MOV, AVI).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-center mb-4">
            <Input 
              ref={fileInputRef} 
              type="file" 
              accept="video/*" 
              onChange={handleVideoSelected} 
              className="hidden" 
            />
            
            <Button 
              onClick={handlePickVideo}
              className="bg-green-600 hover:bg-green-700"
            >
              <Upload className="w-4 h-4 mr-2" /> 
              Seleccionar Video
            </Button>

            {selectedVideo && (
              <>
                <Button
                  onClick={handleAnalyzeVideo}
                  disabled={isAnalyzing}
                  className="bg-yellow-400 text-black hover:bg-yellow-300 font-semibold"
                >
                  <Brain className="w-4 h-4 mr-2" />
                  {isAnalyzing ? 'Analizando...' : 'Analizar Video'}
                </Button>

                <Button
                  onClick={removeVideo}
                  variant="outline"
                  className="border-red-400 text-red-400 hover:bg-red-400/10"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Quitar Video
                </Button>
              </>
            )}

            {isAnalyzing && (
              <Badge className="bg-green-500 animate-pulse">
                Procesando video...
              </Badge>
            )}
          </div>

          {/* Preview de video */}
          {selectedVideo && (
            <div>
              <h4 className="text-white font-medium mb-3">Video Seleccionado</h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Video player */}
                <div className="relative rounded-lg overflow-hidden border border-green-400/20">
                  <video 
                    ref={videoPreviewRef}
                    src={selectedVideo.url}
                    className="w-full h-64 object-cover bg-black"
                    controls
                  />
                </div>

                {/* Información del video */}
                <div className="space-y-4">
                  <div className="p-4 bg-green-500/10 rounded-lg border border-green-400/20">
                    <h5 className="text-white font-medium mb-2">Detalles del Video</h5>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Nombre:</span>
                        <span className="text-white truncate ml-2">{selectedVideo.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Duración:</span>
                        <span className="text-white">{formatDuration(selectedVideo.duration)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Resolución:</span>
                        <span className="text-white">{selectedVideo.width}x{selectedVideo.height}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Tamaño:</span>
                        <span className="text-white">{formatFileSize(selectedVideo.size)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-400/20">
                    <h5 className="text-yellow-400 font-medium mb-2 flex items-center">
                      <Clock className="w-4 h-4 mr-2" />
                      Tips para mejor análisis
                    </h5>
                    <ul className="text-sm text-gray-300 space-y-1">
                      <li>• Mantén buena iluminación</li>
                      <li>• Enfoca todo el cuerpo</li>
                      <li>• Realiza 3-5 repeticiones</li>
                      <li>• Evita movimientos de cámara</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cámara en Vivo - Corrección en Tiempo Real */}
      <Card className="bg-black/80 border-yellow-400/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Camera className="w-5 h-5 mr-2 text-yellow-400" />
            Cámara en Vivo - Corrección en Tiempo Real
          </CardTitle>
          <CardDescription className="text-gray-400">
            Activa tu cámara para obtener feedback instantáneo mientras entrenas. Incluye grabación opcional y análisis en vivo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Características de la cámara en vivo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="flex items-center space-x-3 p-3 bg-yellow-500/10 rounded-lg border border-yellow-400/20">
              <Zap className="w-8 h-8 text-yellow-400" />
              <div>
                <h4 className="text-white font-medium">Tiempo Real</h4>
                <p className="text-gray-400 text-sm">Análisis instantáneo</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-yellow-500/10 rounded-lg border border-yellow-400/20">
              <Eye className="w-8 h-8 text-yellow-400" />
              <div>
                <h4 className="text-white font-medium">Feedback Inmediato</h4>
                <p className="text-gray-400 text-sm">Correcciones al instante</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-yellow-500/10 rounded-lg border border-yellow-400/20">
              <Settings className="w-8 h-8 text-yellow-400" />
              <div>
                <h4 className="text-white font-medium">Grabación Opcional</h4>
                <p className="text-gray-400 text-sm">Guarda tus entrenamientos</p>
              </div>
            </div>
          </div>

          {/* Video preview para cámara en vivo */}
          <div className="aspect-video bg-gray-900/60 rounded-lg overflow-hidden relative mb-6">
            <video 
              ref={liveVideoRef} 
              className="w-full h-full object-cover" 
              playsInline 
              muted 
            />
            {!isCameraOn && (
              <div className="absolute inset-0 flex items-center justify-center text-center">
                <div>
                  <Camera className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 text-lg mb-2">Activa la cámara para corrección en vivo</p>
                  <p className="text-gray-500 text-sm">Asegúrate de tener buena iluminación y espacio</p>
                </div>
              </div>
            )}
            {isCameraOn && (
              <div className="absolute top-4 left-4 flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-white text-sm bg-black/50 px-2 py-1 rounded">
                  {isRecording ? 'Grabando' : 'En vivo'}
                </span>
              </div>
            )}
          </div>

          {/* Controles de cámara en vivo */}
          <div className="flex flex-wrap gap-3 justify-center mb-6">
            {!isCameraOn ? (
              <Button 
                onClick={startCamera} 
                className="bg-green-600 hover:bg-green-700"
              >
                <Play className="w-4 h-4 mr-2" /> 
                Activar Cámara en Vivo
              </Button>
            ) : (
              <>
                <Button 
                  onClick={stopCamera} 
                  variant="destructive"
                >
                  <Pause className="w-4 h-4 mr-2" /> 
                  Detener Cámara
                </Button>
                
                {!isRecording ? (
                  <Button 
                    onClick={startRecording} 
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Play className="w-4 h-4 mr-2" /> 
                    Iniciar Grabación
                  </Button>
                ) : (
                  <Button 
                    onClick={stopRecording} 
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Pause className="w-4 h-4 mr-2" /> 
                    Detener Grabación
                  </Button>
                )}
                
                <Button 
                  onClick={downloadRecording} 
                  variant="outline" 
                  className="border-yellow-400 text-yellow-400 hover:bg-yellow-400/10"
                  disabled={recordedBlobsRef.current.length === 0}
                >
                  <RotateCcw className="w-4 h-4 mr-2" /> 
                  Descargar Grabación
                </Button>
                
                <Button 
                  onClick={handleLiveAnalysis}
                  disabled={isLiveAnalyzing}
                  className="bg-yellow-400 text-black hover:bg-yellow-300 font-semibold"
                >
                  <Brain className="w-4 h-4 mr-2" />
                  {isLiveAnalyzing ? 'Analizando...' : 'Análisis en Vivo'}
                </Button>
              </>
            )}

            {isLiveAnalyzing && (
              <Badge className="bg-yellow-500 animate-pulse">
                Capturando y analizando...
              </Badge>
            )}
          </div>

          {/* Tips para mejor análisis en vivo */}
          {isCameraOn && (
            <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-400/20">
              <h5 className="text-yellow-400 font-medium mb-2 flex items-center">
                <Settings className="w-4 h-4 mr-2" />
                Consejos para mejor análisis en vivo
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
                <ul className="space-y-1">
                  <li>• Mantén todo el cuerpo visible</li>
                  <li>• Usa ropa que contraste con el fondo</li>
                  <li>• Iluminación uniforme desde el frente</li>
                </ul>
                <ul className="space-y-1">
                  <li>• Evita sombras pronunciadas</li>
                  <li>• Mantén la cámara estable</li>
                  <li>• Distancia de 2-3 metros es ideal</li>
                </ul>
              </div>
            </div>
          )}

          {/* Canvas oculto para capturas */}
          <canvas ref={canvasRef} className="hidden" />
        </CardContent>
      </Card>

      {/* Resultados del análisis */}
      {showResults && analysisResult && (
        <AnalysisResult
          result={analysisResult}
          onSpeakCorrections={() => speakCorrections(analysisResult)}
          onStopSpeaking={stopSpeaking}
        />
      )}
    </div>
  );
}