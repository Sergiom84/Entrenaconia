import React, { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'
import { useUserContext } from '@/contexts/UserContext'
import {
  Camera,
  Eye,
  Zap,
  Target,
  AlertTriangle,
  CheckCircle,
  Play,
  Pause,
  RotateCcw,
  Settings,
  Smartphone,
  Wifi,
  Clock,
  TrendingUp,
  ExternalLink,
  Brain,
  Image as ImageIcon,
  Upload,
} from 'lucide-react'

// Estilos para la animación del modal
const modalStyles = `
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-fade-in {
  animation: fadeIn 0.2s ease-out;
}
`

/**
 * Corrección por Video IA — Versión conectable
 *
 * Cambios clave:
 *  - Vista previa real de cámara (getUserMedia) con start/stop.
 *  - Opción de grabar y almacenar el vídeo localmente (MediaRecorder).
 *  - Botón “Subir fotos” (múltiples imágenes) con previsualización y envío a backend.
 *  - Biblioteca de ejercicios dinámica vía API, con fallback local.
 *  - Métricas/estadísticas cargadas desde backend, con fallback.
 *  - Hook de “Corrección IA Avanzada” preparado para tu endpoint que usa OpenAI.
 *  - Código defensivo y accesible. Diseño consistente con tu UI (shadcn + Tailwind).
 */

const FALLBACK_EXERCISES = [
  {
    id: 'squat',
    name: 'Sentadilla',
    commonErrors: [
      'Rodillas hacia adentro (valgo)',
      'Inclinación excesiva del torso',
      'Falta de profundidad',
      'Peso en puntas de pies',
    ],
    keyPoints: [
      'Rodillas alineadas con pies',
      'Descender hasta ~90° de flexión',
      'Pecho erguido',
      'Peso en talones',
    ],
  },
  {
    id: 'deadlift',
    name: 'Peso Muerto',
    commonErrors: [
      'Espalda redondeada',
      'Barra alejada del cuerpo',
      'Hiperextensión lumbar',
      'Rodillas bloqueadas prematuramente',
    ],
    keyPoints: [
      'Columna neutra',
      'Barra pegada al cuerpo',
      'Activar glúteos en la subida',
      'Extensión simultánea cadera-rodilla',
    ],
  },
  {
    id: 'pushup',
    name: 'Flexión de Brazos',
    commonErrors: [
      'Cadera elevada o hundida',
      'ROM incompleto',
      'Manos mal posicionadas',
      'Cabeza adelantada',
    ],
    keyPoints: [
      'Línea recta cabeza-talones',
      'Descender hasta tocar suelo',
      'Manos bajo hombros',
      'Mirada neutra',
    ],
  },
]

export default function VideoCorrectionSection() {
  const videoRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const recordedBlobsRef = useRef([])
  const fileInputRef = useRef(null)
  const canvasRef = useRef(null) // para capturas de fotogramas

  const [isCameraOn, setIsCameraOn] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isAnalyzingPhotos, setIsAnalyzingPhotos] = useState(false)
  const [selectedExerciseId, setSelectedExerciseId] = useState('squat')
  const [showAdvancedIA, setShowAdvancedIA] = useState(false)
  const [advancedResult, setAdvancedResult] = useState(null)
  const [photos, setPhotos] = useState([]) // previsualizaciones locales
  const [uploadResponses, setUploadResponses] = useState([]) // respuestas del backend
  const [exercises, setExercises] = useState(FALLBACK_EXERCISES)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [stats, setStats] = useState({
    precisionPromedio: '—',
    sesionesAnalizadas: 0,
    reduccionErrores: '—',
    ejerciciosDominados: 0,
    mejoras: [],
    erroresComunes: [],
  })

  const { user } = useAuth()
  const { userData } = useUserContext()

  // Text-to-Speech (Web Speech API)
  const voiceRef = useRef(null)

  useEffect(() => {
    if ('speechSynthesis' in window) {
      const updateVoices = () => {
        const voices = window.speechSynthesis.getVoices() || []
        const es = voices.find(v => (v.lang || '').toLowerCase().startsWith('es'))
        voiceRef.current = es || voices[0] || null
      }
      updateVoices()
      window.speechSynthesis.onvoiceschanged = updateVoices
    }
  }, [])

  const speakText = (text) => {
    if (!('speechSynthesis' in window)) {
      alert('Lo siento, tu navegador no soporta síntesis de voz.')
      return
    }
    // Cancel any ongoing speech to avoid overlap
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'es-ES'
    utterance.rate = 0.95
    utterance.pitch = 1.0
    utterance.volume = 0.9
    if (voiceRef.current) utterance.voice = voiceRef.current

    window.speechSynthesis.speak(utterance)
  }

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }

  // Function to speak all corrections
  const speakCorrections = () => {
    if (!advancedResult || !advancedResult.correcciones_priorizadas) {
      alert('No hay correcciones disponibles para reproducir.')
      return
    }

    let textToSpeak = 'Correcciones principales: '

    advancedResult.correcciones_priorizadas.forEach((correction, index) => {
      const accion = typeof correction === 'string' ? correction : (correction.accion || '')
      if (accion) textToSpeak += `${index + 1}. ${accion}. `
    })

    const fv = advancedResult.feedback_voz
    if (Array.isArray(fv) && fv.length > 0) {
      textToSpeak += 'Indicaciones clave: ' + fv.join('. ') + '.'
    } else if (typeof fv === 'string' && fv.trim()) {
      textToSpeak += 'Indicaciones clave: ' + fv
    }

    speakText(textToSpeak)
  }

  // Normaliza la respuesta del endpoint de fotos al formato esperado por la UI
  const normalizePhotoAnalysis = (payload, fallbackExercise) => {
    try {
      const a = payload?.analysis || {}
      const md = payload?.metadata || {}

      const mapRiskToConfidence = (risk) => {
        const r = String(risk || '').toLowerCase()
        if (r === 'bajo') return 'alta'
        if (r === 'medio' || r === 'media') return 'media'
        if (r === 'alto') return 'baja'
        return 'media'
      }

      // Fuente de correcciones: soporta "correcciones" y "correcciones_priorizadas"
      const correctionsSrc = Array.isArray(a.correcciones_priorizadas)
        ? a.correcciones_priorizadas
        : (Array.isArray(a.correcciones) ? a.correcciones : [])

      const correcciones = correctionsSrc.map((c) => {
        if (typeof c === 'string') {
          return { prioridad: 'media', accion: c, fundamento: '' }
        }
        return {
          prioridad: c.prioridad || c.importancia || 'media',
          accion: c.accion || c.solucion || c.aspecto || c.descripcion || c.description || '',
          fundamento: c.fundamento || c.problema || c.evidencia || c.evidence || ''
        }
      })

      const feedbackVoz = correcciones
        .map(c => c.accion)
        .filter(Boolean)
        .slice(0, 5)

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
          model: md.model_used || md.model || 'gpt-4o-mini',
          imageCount: md.photos_count || md.imageCount || 0,
          confidence: mapRiskToConfidence(a.nivel_riesgo)
        }
      }
    } catch (e) {
      console.warn('No se pudo normalizar análisis de foto, devolviendo payload crudo:', e)
      return payload
    }
  }

  // Cargar biblioteca de ejercicios desde el backend
  useEffect(() => {
    const loadExercises = async () => {
      try {
        const res = await fetch('/api/exercises?limit=500')
        if (res.ok) {
          const data = await res.json()
          // Mapeamos al esquema esperado
          const mapped = (data?.items || data || []).map((e) => ({
            id: e.id || e.slug || e.code || crypto.randomUUID(),
            name: e.name || e.titulo || 'Ejercicio',
            commonErrors: e.common_errors || e.errores || [],
            keyPoints: e.key_points || e.puntos_clave || [],
          }))
          if (mapped.length) setExercises(mapped)
        }
      } catch (e) {
        console.warn('Usando ejercicios fallback - API no disponible:', e.message)
      }
    }
    // Solo intentar cargar si no estamos en desarrollo o si la API existe
    loadExercises()
  }, [])

  // Cargar estadísticas reales del usuario
  useEffect(() => {
    if (!user?.id) return // No cargar si no hay usuario

    const loadStats = async () => {
      try {
        const res = await fetch(`/api/technique/stats?userId=${user.id}`)
        if (res.ok) {
          const s = await res.json()
          setStats({
            precisionPromedio: s.precision_promedio ?? '—',
            sesionesAnalizadas: s.sesiones_analizadas ?? 0,
            reduccionErrores: s.reduccion_errores ?? '—',
            ejerciciosDominados: s.ejercicios_dominados ?? 0,
            mejoras: s.mejoras || [],
            erroresComunes: s.errores_comunes || [],
          })
        }
      } catch (e) {
        console.warn('Usando estadísticas fallback - API no disponible:', e.message)
      }
    }
    loadStats()
  }, [user?.id])

  const startCamera = async () => {
    try {
      // Verificar si el navegador soporta getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Tu navegador no soporta el acceso a la cámara. Usa Chrome, Firefox o Safari moderno.')
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      mediaStreamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setIsCameraOn(true)
    } catch (err) {
      console.error('No se pudo iniciar la cámara:', err)
      let errorMessage = 'No se pudo acceder a la cámara. '

      if (err.name === 'NotAllowedError') {
        errorMessage += 'Por favor, permite el acceso a la cámara en tu navegador.'
      } else if (err.name === 'NotFoundError') {
        errorMessage += 'No se encontró ninguna cámara disponible.'
      } else if (err.name === 'NotReadableError') {
        errorMessage += 'La cámara está siendo utilizada por otra aplicación.'
      } else {
        errorMessage += `Error: ${err.message}`
      }

      alert(errorMessage)
    }
  }

  const stopCamera = () => {
    try {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
      mediaStreamRef.current = null
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
      setIsCameraOn(false)
    } catch (err) {
      console.error('Error al detener la cámara:', err)
    }
  }

  const startRecording = () => {
    try {
      if (!mediaStreamRef.current) {
        alert('Primero debes activar la cámara para poder grabar.')
        return
      }

      recordedBlobsRef.current = []
      const stream = mediaStreamRef.current

      // Verificar soporte para MediaRecorder
      if (!MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        console.warn('Codec vp9,opus no soportado, usando configuración básica')
        const recorder = new MediaRecorder(stream)
        mediaRecorderRef.current = recorder
      } else {
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' })
        mediaRecorderRef.current = recorder
      }

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedBlobsRef.current.push(e.data)
      }

      mediaRecorderRef.current.start(100) // trozos cada 100ms
      setIsRecording(true)
    } catch (err) {
      console.error('No se pudo iniciar la grabación:', err)
      alert('Error al iniciar la grabación: ' + err.message)
    }
  }

  const stopRecording = () => {
    try {
      mediaRecorderRef.current?.stop()
      setIsRecording(false)
    } catch (err) {
      console.error('Error al detener la grabación:', err)
    }
  }

  const downloadRecording = () => {
    const blob = new Blob(recordedBlobsRef.current, { type: 'video/webm' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = url
    a.download = 'entrenamiento.webm'
    document.body.appendChild(a)
    a.click()
    URL.revokeObjectURL(url)
  }

  const captureFrame = async () => {
    // Captura un fotograma del video para enviar al backend o IA
    const video = videoRef.current
    if (!video) return null
    const canvas = canvasRef.current
    if (!canvas) return null
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
  }

  const handlePickPhotos = () => {
    fileInputRef.current?.click()
  }

  const handlePhotosSelected = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    // Previews locales
    const previews = await Promise.all(
      files.map((file) =>
        new Promise((res) => {
          const reader = new FileReader()
          reader.onload = () => res({ name: file.name, url: reader.result })
          reader.readAsDataURL(file)
        })
      )
    )
    setPhotos((prev) => [...prev, ...previews])

    // Subida opcional inmediata (solo si hay usuario)
    if (!user?.id) {
      console.warn('Usuario no identificado - guardando fotos solo localmente')
      return
    }

    try {
      setIsUploading(true)
      const fd = new FormData()
      files.forEach((f) => fd.append('images', f))
      fd.append('exerciseId', selectedExerciseId)
      fd.append('userId', user.id)

      const res = await fetch('/api/uploads/images', { method: 'POST', body: fd })
      if (res.ok) {
        const payload = await res.json()
        setUploadResponses((prev) => [...prev, payload])
      } else {
        console.warn('Error en la subida - manteniendo fotos localmente')
      }
    } catch (err) {
      console.error('Error subiendo imágenes - manteniendo fotos localmente:', err)
    } finally {
      setIsUploading(false)
    }
  }

  const handleAdvancedIA = async () => {
    if (!isCameraOn) {
      alert('Por favor, activa la cámara primero para usar la Corrección IA Avanzada.')
      return
    }

    if (!user?.id) {
      alert('Necesitas estar autenticado para usar la Corrección IA Avanzada.')
      return
    }

    try {
      const frameBlob = await captureFrame()
      if (!frameBlob) {
        alert('No se pudo capturar el fotograma de la cámara.')
        return
      }

      const fd = new FormData()
      fd.append('frame', frameBlob, 'frame.jpg')
      fd.append('exerciseId', selectedExerciseId)
      fd.append('userId', user.id)
      fd.append('perfilUsuario', JSON.stringify({
        edad: userData?.edad,
        peso: userData?.peso,
        altura: userData?.altura,
        nivel: userData?.nivel,
        lesiones: userData?.lesiones,
        equipamiento: userData?.equipamiento,
        objetivos: userData?.objetivos,
      }))

      // Este endpoint debería aplicar el "prompt perfecto" y tu API Key desde el servidor
      const res = await fetch('/api/ai/advanced-correction', { method: 'POST', body: fd })
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`IA avanzada no disponible: ${errorText}`)
      }

  const data = await res.json()
  console.log('Corrección IA Avanzada:', data)
  setAdvancedResult(data)
  setShowAdvancedIA(true)

      // Show success message without forcing user to check console
      alert('¡Análisis IA completado exitosamente! Los resultados se muestran a continuación.')
    } catch (err) {
      console.error('Error en Corrección IA Avanzada:', err)
      alert(`No se pudo ejecutar la Corrección IA Avanzada: ${err.message}`)
    }
  }

  const handlePhotosAnalysis = async () => {
    if (!photos.length) {
      alert('Por favor, sube al menos una imagen para analizar.')
      return
    }

    if (!user?.id) {
      alert('Necesitas estar autenticado para usar el Análisis IA de Fotos.')
      return
    }

    try {
      setIsAnalyzingPhotos(true)

      const fd = new FormData()

      // Convertir las fotos de base64 a blob y agregarlas al FormData
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i]
        // Convertir data URL a blob
        const response = await fetch(photo.url)
        const blob = await response.blob()
        fd.append('photos', blob, photo.name)
      }

      // Campos esperados por el endpoint de fotos
      fd.append('exercise_name', selectedExerciseId)
      fd.append('exercise_description', '')
      fd.append('user_context', JSON.stringify({
        edad: userData?.edad,
        peso: userData?.peso,
        altura: userData?.altura,
        nivel: userData?.nivel,
        lesiones: userData?.lesiones,
        equipamiento: userData?.equipamiento,
        objetivos: userData?.objetivos,
      }))

      console.log(`🖼️ Analizando ${photos.length} fotos subidas...`)

      // Llamar a la ruta específica de análisis de fotos
      const res = await fetch('/api/ai-photo-correction/analyze', { method: 'POST', body: fd })
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Análisis IA no disponible: ${errorText}`)
      }

      const data = await res.json()
      console.log('Análisis IA de Fotos (raw):', data)
      const normalized = normalizePhotoAnalysis(data, selectedExerciseId)
      console.log('Análisis IA de Fotos (normalizado):', normalized)
      setAdvancedResult(normalized)
      setShowAdvancedIA(true)

      // Show success message without forcing user to check console
      alert('¡Análisis IA de fotos completado exitosamente! Los resultados se muestran a continuación.')
    } catch (err) {
      console.error('Error en Análisis IA de Fotos:', err)
      alert(`No se pudo ejecutar el Análisis IA de Fotos: ${err.message}`)
    } finally {
      setIsAnalyzingPhotos(false)
    }
  }

  const selectedExercise = exercises.find((e) => e.id === selectedExerciseId) || exercises[0]

  // Características (texto) — mantenemos estático
  const analysisFeatures = [
    {
      title: 'Análisis Postural en Tiempo Real',
      description: 'Detección de desalineaciones y compensaciones',
      icon: <Eye className="w-6 h-6 text-blue-400" />,
      details: [
        'Análisis de ~33 puntos corporales',
        'Detección de asimetrías',
        'Evaluación de cadena cinética',
        'Corrección de compensaciones',
      ],
    },
    {
      title: 'Rango de Movimiento',
      description: 'Medición de ángulos y amplitud',
      icon: <Target className="w-6 h-6 text-green-400" />,
      details: [
        'Flexión/extensión articular',
        'Movilidad específica',
        'Limitaciones funcionales',
        'Progresión de flexibilidad',
      ],
    },
    {
      title: 'Tempo y Ritmo',
      description: 'Velocidad de ejecución y control excéntrico',
      icon: <Clock className="w-6 h-6 text-yellow-400" />,
      details: ['Fases concéntrica/excéntrica', 'Tiempo bajo tensión', 'Estabilidad', 'Optimización del tempo'],
    },
    {
      title: 'Reconocimiento de Ejercicios',
      description: 'Identificación automática del ejercicio',
      icon: <Zap className="w-6 h-6 text-purple-400" />,
      details: ['Base de +500 ejercicios', 'Variaciones', 'Corrección de ejercicio', 'Alternativas'],
    },
  ]

  return (
    <div className="min-h-screen bg-black text-white p-6 pb-24">
      <style>{modalStyles}</style>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-yellow-400 to-yellow-200 bg-clip-text text-transparent">
            Corrección por Video IA
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Analiza tu técnica en tiempo real y recibe feedback inmediato para mejorar la forma y prevenir lesiones.
          </p>
        </div>

        {/* Bloque de Cámara y Grabación */}
        <Card className="bg-black/80 border-yellow-400/20 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Camera className="w-5 h-5 mr-2 text-yellow-400" />
              Cámara / Análisis en vivo
            </CardTitle>
            <CardDescription className="text-gray-400">
              Activa tu cámara para analizar el movimiento. Puedes capturar un fotograma o grabar un clip corto.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="aspect-video bg-gray-900/60 rounded-lg overflow-hidden relative mb-4">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              {!isCameraOn && (
                <div className="absolute inset-0 flex items-center justify-center text-center">
                  <div>
                    <Camera className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">Activa la cámara para comenzar</p>
                  </div>
                </div>
              )}
            </div>

            {/* Controles de cámara */}
            <div className="flex flex-wrap gap-3 justify-center">
              {!isCameraOn ? (
                <Button onClick={startCamera} className="bg-green-600 hover:bg-green-700">
                  <Play className="w-4 h-4 mr-2" /> Activar cámara
                </Button>
              ) : (
                <>
                  <Button onClick={stopCamera} variant="destructive">
                    <Pause className="w-4 h-4 mr-2" /> Detener cámara
                  </Button>
                  {!isRecording ? (
                    <Button onClick={startRecording} className="bg-red-600 hover:bg-red-700">
                      <Play className="w-4 h-4 mr-2" /> Grabar
                    </Button>
                  ) : (
                    <Button onClick={stopRecording} className="bg-red-600 hover:bg-red-700">
                      <Pause className="w-4 h-4 mr-2" /> Detener grabación
                    </Button>
                  )}
                  <Button onClick={downloadRecording} variant="outline" className="border-yellow-400 text-yellow-400 hover:bg-yellow-400/10">
                    <RotateCcw className="w-4 h-4 mr-2" /> Descargar clip
                  </Button>
                </>
              )}

              <Button onClick={handleAdvancedIA} className="bg-yellow-400 text-black hover:bg-yellow-300">
                <Brain className="w-4 h-4 mr-2" /> Activar Corrección IA Avanzada
              </Button>

              <Button onClick={() => setShowInfoModal(true)} className="bg-yellow-400 text-black hover:bg-yellow-300 font-semibold">
                Información
              </Button>
            </div>

            {/* Canvas oculto para capturas */}
            <canvas ref={canvasRef} className="hidden" />
          </CardContent>
        </Card>

        {/* Biblioteca de Ejercicios */}
        <Card className="bg-black/80 border-yellow-400/20 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Biblioteca de Ejercicios</CardTitle>
            <CardDescription className="text-gray-400">
              Elige el ejercicio para personalizar el análisis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-6">
              {exercises.map((ex) => (
                <Button
                  key={ex.id}
                  variant={selectedExerciseId === ex.id ? 'default' : 'outline'}
                  onClick={() => setSelectedExerciseId(ex.id)}
                  className={selectedExerciseId === ex.id
                    ? 'bg-yellow-400 text-black hover:bg-yellow-300'
                    : 'border-yellow-400/50 text-yellow-400 hover:border-yellow-400 hover:bg-yellow-400/10'}
                >
                  {ex.name}
                </Button>
              ))}
            </div>

            {selectedExercise && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-white font-semibold mb-3 flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2 text-red-400" /> Errores comunes
                  </h4>
                  <ul className="space-y-2">
                    {(selectedExercise.commonErrors || []).map((err, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 bg-red-400 rounded-full" />
                        <span className="text-gray-300">{err}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-3 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-400" /> Puntos clave
                  </h4>
                  <ul className="space-y-2">
                    {(selectedExercise.keyPoints || []).map((pt, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">


                        <div className="w-2 h-2 bg-green-400 rounded-full" />
                        <span className="text-gray-300">{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subida de Fotos (nuevo) */}
        <Card className="bg-black/80 border-yellow-400/20 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <ImageIcon className="w-5 h-5 mr-2 text-yellow-400" /> Subir fotos para análisis
            </CardTitle>
            <CardDescription className="text-gray-400">
              Sube imágenes (frontal/lateral/posterior) para obtener feedback postural.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 items-center">
              <Input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotosSelected} className="hidden" />
              <Button onClick={handlePickPhotos} className="bg-blue-600 hover:bg-blue-700">
                <Upload className="w-4 h-4 mr-2" /> Subir fotos
              </Button>
              {isUploading && <Badge className="bg-yellow-500">Subiendo…</Badge>}

              {photos.length > 0 && (
                <Button
                  onClick={handlePhotosAnalysis}
                  disabled={isAnalyzingPhotos}
                  className="bg-yellow-400 text-black hover:bg-yellow-300 font-semibold"
                >
                  <Brain className="w-4 h-4 mr-2" />
                  {isAnalyzingPhotos ? 'Analizando...' : 'Análisis'}
                </Button>
              )}
              {isAnalyzingPhotos && <Badge className="bg-yellow-500">Analizando fotos...</Badge>}
            </div>

            {photos.length > 0 && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                {photos.map((p, i) => (
                  <div key={i} className="relative rounded-lg overflow-hidden border border-yellow-400/20">
                    <img src={p.url} alt={p.name} className="w-full h-36 object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-xs p-1 truncate">{p.name}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal de información */}
        {showInfoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
            <div className="bg-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full mx-4 p-6 relative animate-fade-in max-h-[90vh]">
              <h2 className="text-2xl font-bold text-yellow-400 mb-4 text-center">Información</h2>
              <div className="max-h-[60vh] overflow-y-auto pr-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {analysisFeatures.map((feature, index) => (
                    <Card key={index} className="bg-black/80 border-yellow-400/20">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          {feature.icon}
                          <div>
                            <CardTitle className="text-white text-lg">{feature.title}</CardTitle>
                            <CardDescription className="text-gray-400">{feature.description}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {feature.details.map((detail, idx) => (
                            <li key={idx} className="flex items-center gap-2 text-sm">
                              <CheckCircle className="w-4 h-4 text-green-400" />
                              <span className="text-gray-300">{detail}</span>
                            </li>



                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
              <div className="flex justify-center mt-6">
                <Button onClick={() => setShowInfoModal(false)} className="bg-yellow-400 text-black hover:bg-yellow-300 font-semibold px-8 py-2 rounded-lg">
                  Aceptar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Estadísticas y Progreso (dinámico) */}
        <Card className="bg-black/80 border-yellow-400/20 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-yellow-400" /> Progreso de Técnica
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{stats.precisionPromedio}</div>
                <div className="text-sm text-gray-400">Precisión promedio</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">{stats.sesionesAnalizadas}</div>
                <div className="text-sm text-gray-400">Sesiones analizadas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">{stats.reduccionErrores}</div>
                <div className="text-sm text-gray-400">Reducción de errores</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">{stats.ejerciciosDominados}</div>
                <div className="text-sm text-gray-400">Ejercicios dominados</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resultado IA Avanzada */}
        {showAdvancedIA && advancedResult && (
          <Card className="bg-black/80 border-yellow-400/40 mb-8">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Brain className="w-5 h-5 mr-2 text-yellow-400" /> Resultado Análisis IA
              </CardTitle>
              <CardDescription className="text-gray-400">
                Feedback estructurado generado por el modelo (beta)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/30">
                  <div className="text-xs uppercase tracking-wide text-yellow-500">Ejercicio</div>
                  <div className="text-lg font-semibold text-white">{advancedResult.ejercicio || '—'}</div>
                </div>
                <div className="p-3 rounded-lg bg-green-400/10 border border-green-400/30">
                  <div className="text-xs uppercase tracking-wide text-green-400">Confianza</div>
                  <div className="text-lg font-semibold text-white">{advancedResult.confianza_global || advancedResult.metadata?.confidence || '—'}</div>
                </div>
                <div className="p-3 rounded-lg bg-blue-400/10 border border-blue-400/30">
                  <div className="text-xs uppercase tracking-wide text-blue-300">Imágenes</div>
                  <div className="text-lg font-semibold text-white">{advancedResult.metadata?.imageCount ?? '—'}</div>
                </div>
              </div>

        {advancedResult === null && showAdvancedIA && (
          <div className="p-3 rounded bg-yellow-400/10 border border-yellow-400/30 text-yellow-200 text-sm">
            No hay resultados disponibles todavía.
          </div>
        )}

              {/* Correcciones Prioritarias */}
              {Array.isArray(advancedResult.correcciones_priorizadas) && advancedResult.correcciones_priorizadas.length > 0 && (
                <div>
                  <h4 className="text-white font-semibold mb-3 flex items-center justify-between">
                    <div className="flex items-center">
                      <Target className="w-4 h-4 mr-2 text-yellow-400" /> Correcciones Prioritarias
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={speakCorrections}
                        size="sm"
                        className="bg-yellow-600 hover:bg-yellow-700 text-black"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Escuchar
                      </Button>
                      <Button
                        onClick={stopSpeaking}
                        size="sm"
                        variant="outline"
                        className="border-yellow-600 text-yellow-400 hover:bg-yellow-400/10"
                      >
                        <Pause className="w-4 h-4 mr-1" />
                        Detener
                      </Button>
                    </div>
                  </h4>
                  <ul className="space-y-3">
                    {advancedResult.correcciones_priorizadas.map((c, idx) => (
                      <li key={idx} className="p-3 rounded border border-yellow-400/20 bg-yellow-400/5">
                        <div className="flex flex-wrap gap-2 items-center mb-1">
                          <Badge className={c.prioridad === 'alta' ? 'bg-red-500' : c.prioridad === 'media' ? 'bg-yellow-500' : 'bg-green-600'}>
                            {c.prioridad || '—'}
                          </Badge>
                          {c.cue && <span className="text-xs text-gray-400">Cue: {c.cue}</span>}
                        </div>
                        <div className="text-sm text-gray-200"><strong>Acción:</strong> {c.accion || '—'}</div>
                        {c.fundamento && (
                          <div className="text-xs text-gray-400 mt-1"><strong>Por qué:</strong> {c.fundamento}</div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Errores detectados */}
              {Array.isArray(advancedResult.errores_detectados) && advancedResult.errores_detectados.length > 0 && (
                <div>
                  <h4 className="text-white font-semibold mb-3 flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2 text-red-400" /> Errores Detectados
                  </h4>
                  <ul className="space-y-3">
                    {advancedResult.errores_detectados.map((e, idx) => (
                      <li key={idx} className="p-3 rounded border border-red-400/30 bg-red-400/10">
                        <div className="flex flex-wrap gap-2 items-center mb-1">
                          <Badge className="bg-red-500/80">{e.severidad || '—'}</Badge>
                          <Badge variant="outline" className="border-red-400 text-red-300 text-xs">{e.tipo || '—'}</Badge>
                          {e.zona && <span className="text-xs text-gray-300">{e.zona}</span>}
                        </div>
                        <div className="text-sm text-gray-200">{e.descripcion || '—'}</div>
                        {e.impacto && <div className="text-xs text-gray-400 mt-1">Impacto: {e.impacto}</div>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Métricas */}
              {advancedResult.metricas && (
                <div>
                  <h4 className="text-white font-semibold mb-3 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-2 text-green-400" /> Métricas
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    {Object.entries(advancedResult.metricas).map(([k,v]) => (
                      <div key={k} className="p-2 rounded bg-green-400/10 border border-green-400/20">
                        <div className="text-xs uppercase tracking-wide text-green-300">{k.replace(/_/g,' ')}</div>
                        <div className="text-white font-semibold">{v === null ? '—' : String(v)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Puntos clave & Riesgos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Array.isArray(advancedResult.puntos_clave) && advancedResult.puntos_clave.length > 0 && (
                  <div>
                    <h4 className="text-white font-semibold mb-3 flex items-center">
                      <CheckCircle className="w-4 h-4 mr-2 text-green-400" /> Puntos Clave
                    </h4>
                    <ul className="space-y-2 text-sm">
                      {advancedResult.puntos_clave.map((p,idx)=>(
                        <li key={idx} className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-400" /> <span className="text-gray-300">{p}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
                {Array.isArray(advancedResult.riesgos_potenciales) && advancedResult.riesgos_potenciales.length > 0 && (
                  <div>
                    <h4 className="text-white font-semibold mb-3 flex items-center">
                      <AlertTriangle className="w-4 h-4 mr-2 text-yellow-400" /> Riesgos Potenciales
                    </h4>
                    <ul className="space-y-2 text-sm">
                      {advancedResult.riesgos_potenciales.map((p,idx)=>(
                        <li key={idx} className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-400" /> <span className="text-gray-300">{p}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Feedback de Voz sugerido */}
              {Array.isArray(advancedResult.feedback_voz) && advancedResult.feedback_voz.length > 0 && (
                <div>
                  <h4 className="text-white font-semibold mb-3 flex items-center justify-between">
                    <div className="flex items-center">
                      <Play className="w-4 h-4 mr-2 text-purple-400" /> Cues Verbales
                    </div>
                    <Button
                      onClick={speakCorrections}
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Reproducir
                    </Button>
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {advancedResult.feedback_voz.map((c,idx)=>(
                      <Badge key={idx} className="bg-purple-600 text-white">{c}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Overlay recomendado (placeholder listado) */}
              {Array.isArray(advancedResult.overlay_recomendado) && advancedResult.overlay_recomendado.length > 0 && (
                <div>
                  <h4 className="text-white font-semibold mb-3 flex items-center">
                    <ImageIcon className="w-4 h-4 mr-2 text-blue-400" /> Overlays Recomendados
                  </h4>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {advancedResult.overlay_recomendado.map((o,idx)=>{
                      if (typeof o === 'string') {
                        return (
                          <span key={idx} className="px-2 py-1 rounded bg-blue-500/20 border border-blue-400/30 text-blue-200">{o}</span>
                        )
                      }
                      const tipo = o.tipo || o.type || 'overlay'
                      const range = (o.from != null && o.to != null) ? ` (${o.from}-${o.to})` : ''
                      return (
                        <span key={idx} title={JSON.stringify(o)} className="px-2 py-1 rounded bg-blue-500/20 border border-blue-400/30 text-blue-200">{`${tipo}${range}`}</span>
                      )
                    })}
                  </div>
                </div>
              )}

              {advancedResult.siguiente_paso && (
                <div className="p-4 rounded border border-teal-400/40 bg-teal-400/10">
                  <div className="text-xs uppercase tracking-wide text-teal-300 mb-1">Siguiente Paso</div>
                  <div className="text-sm text-teal-100">{advancedResult.siguiente_paso}</div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Alertas dinámicas */}
        <div className="space-y-4 mb-8">
          {stats.mejoras?.length > 0 && (
            <Alert className="border-green-400/30 bg-green-400/10">
              <CheckCircle className="h-4 w-4 text-green-400" />
              <AlertDescription className="text-green-300">
                <strong>Mejoras detectadas:</strong> {stats.mejoras.join(', ')}
              </AlertDescription>
            </Alert>
          )}

          {stats.erroresComunes?.length > 0 && (
            <Alert className="border-yellow-400/30 bg-yellow-400/10">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-yellow-300">
                <strong>Puntos de atención:</strong> {stats.erroresComunes.join(', ')}
              </AlertDescription>
            </Alert>
          )}

          {userData?.nivel === 'principiante' && (
            <Alert className="border-blue-400/30 bg-blue-400/10">
              <CheckCircle className="h-4 w-4 text-blue-400" />
              <AlertDescription className="text-blue-300">
                <strong>Consejo:</strong> Prioriza la técnica antes de subir la intensidad.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Nota de stack */}
        <div className="text-center">
          <Alert className="border-green-400/30 bg-green-400/10 max-w-xl mx-auto">
            <ExternalLink className="w-4 h-4 text-green-400" />
            <AlertDescription className="text-green-300 text-sm">
              Procesamiento recomendado: MediaPipe/TF.js en cliente para landmarks + endpoint con OpenAI en servidor.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  )
}
