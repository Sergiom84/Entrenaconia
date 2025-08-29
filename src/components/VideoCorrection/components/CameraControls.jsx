import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Play, 
  Pause, 
  Camera, 
  Video, 
  StopCircle,
  Eye
} from 'lucide-react';
import { useVideoAnalysis } from '../contexts/VideoAnalysisContext';

export default function CameraControls() {
  const {
    liveVideoRef,
    canvasRef,
    mediaStreamRef,
    mediaRecorderRef,
    recordedBlobsRef,
    isCameraOn,
    setIsCameraOn,
    isRecording,
    setIsRecording,
    isLiveAnalyzing,
    setIsLiveAnalyzing,
    selectedExerciseId,
  } = useVideoAnalysis();

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

      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        liveVideoRef.current.play();
      }

      mediaStreamRef.current = stream;
      setIsCameraOn(true);
      console.log('✅ Cámara activada correctamente');
    } catch (error) {
      console.error('❌ Error activando cámara:', error);
      alert(`No se pudo acceder a la cámara: ${error.message}`);
    }
  };

  const stopCamera = () => {
    try {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = null;
      }
      
      setIsCameraOn(false);
      setIsRecording(false);
      console.log('🛑 Cámara desactivada');
    } catch (error) {
      console.error('❌ Error desactivando cámara:', error);
    }
  };

  const startRecording = () => {
    try {
      if (!mediaStreamRef.current) {
        alert('Primero debes activar la cámara para poder grabar.');
        return;
      }

      recordedBlobsRef.current = [];
      
      const mediaRecorder = new MediaRecorder(mediaStreamRef.current, {
        mimeType: 'video/webm;codecs=vp8,opus'
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedBlobsRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      console.log('🎬 Grabación iniciada');
    } catch (error) {
      console.error('❌ Error iniciando grabación:', error);
      alert(`Error al iniciar la grabación: ${error.message}`);
    }
  };

  const stopRecording = () => {
    try {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      console.log('⏹️ Grabación detenida');
    } catch (error) {
      console.error('❌ Error deteniendo grabación:', error);
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

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-white flex items-center gap-2">
          <Camera className="w-5 h-5" />
          Controles de Cámara en Vivo
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        {/* Video en vivo */}
        <div className="mb-4">
          <video 
            ref={liveVideoRef}
            className="w-full max-w-md mx-auto rounded-lg bg-gray-900"
            muted
            playsInline
            style={{ display: isCameraOn ? 'block' : 'none' }}
          />
          {!isCameraOn && (
            <div className="w-full max-w-md mx-auto h-48 bg-gray-900 rounded-lg flex items-center justify-center">
              <div className="text-center text-gray-400">
                <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Cámara desactivada</p>
              </div>
            </div>
          )}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        {/* Controles de cámara */}
        <div className="flex flex-wrap gap-3 justify-center mb-4">
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
                  className="bg-red-800 hover:bg-red-900"
                >
                  <StopCircle className="w-4 h-4 mr-2" /> 
                  Detener Grabación
                </Button>
              )}
            </>
          )}
        </div>

        {/* Estados visuales */}
        <div className="text-center text-sm">
          {isRecording && (
            <div className="text-red-400 font-semibold animate-pulse">
              🔴 GRABANDO...
            </div>
          )}
          {isCameraOn && !isRecording && (
            <div className="text-green-400">
              📹 Cámara activa
            </div>
          )}
          {isLiveAnalyzing && (
            <div className="text-blue-400 font-semibold">
              🧠 Analizando en vivo...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}