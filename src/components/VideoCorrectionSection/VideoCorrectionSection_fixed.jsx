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

/**
 * Corrección por Video IA — Versión conectable
 *
 * Cambios clave:
 *  - Vista previa real de cámara (getUserMedia) con start/stop.
 *  - Opción de grabar y almacenar el vídeo localmente (MediaRecorder).
 *  - Botón "Subir fotos" (múltiples imágenes) con previsualización y envío a backend.
 *  - Biblioteca de ejercicios dinámica vía API, con fallback local.
 *  - Métricas/estadísticas cargadas desde backend, con fallback.
 *  - Hook de "Corrección IA Avanzada" preparado para tu endpoint que usa OpenAI.
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
  const [showInfoModal, setShowInfoModal] = useState(false);

  const [isCameraOn, setIsCameraOn] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedExerciseId, setSelectedExerciseId] = useState('squat')
  const [showAdvancedIA, setShowAdvancedIA] = useState(false)
  const [photos, setPhotos] = useState([]) // previsualizaciones locales
  const [uploadResponses, setUploadResponses] = useState([]) // respuestas del backend
  const [exercises, setExercises] = useState(FALLBACK_EXERCISES)
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
      // TODO: renderizar overlays/feedback a partir de data
      console.log('Corrección IA Avanzada:', data)
      setShowAdvancedIA(true)
      
      // Mostrar mensaje de éxito al usuario
      alert('¡Análisis IA completado! Revisa la consola para ver los resultados.')
    } catch (err) {
      console.error('Error en Corrección IA Avanzada:', err)
      alert(`No se pudo ejecutar la Corrección IA Avanzada: ${err.message}`)
    }
  }

  const selectedExercise = exercises.find((e) => e.id === selectedExerciseId) || exercises[0]

  // Características (texto) — mantenemos estático
  const analysisFeatures = [
    {
      title: 'Análisis Postural en Tiempo Real',
      description: 'Detección de desalineaciones y compensaciones',
      icon: <Eye className="w-6 h-6 text-blue-400" />, accuracy: '95%',
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
      icon: <Target className="w-6 h-6 text-green-400" />, accuracy: '92%',
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
      icon: <Clock className="w-6 h-6 text-yellow-400" />, accuracy: '89%',
      details: ['Fases concéntrica/excéntrica', 'Tiempo bajo tensión', 'Estabilidad', 'Optimización del tempo'],
    },
    {
      title: 'Reconocimiento de Ejercicios',
      description: 'Identificación automática del ejercicio',
      icon: <Zap className="w-6 h-6 text-purple-400" />, accuracy: '97%',
      details: ['Base de +500 ejercicios', 'Variaciones', 'Corrección de ejercicio', 'Alternativas'],
    },
  ]

  return (
    <div className="min-h-screen bg-black text-white p-6 pb-24">
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

         {/* Botón para mostrar información de análisis */}
         <div className="flex justify-end mb-8">
           <Button onClick={() => setShowInfoModal(true)} className="bg-yellow-400 text-black hover:bg-yellow-300 font-semibold px-6 py-2 rounded-lg shadow-lg">
             Información
           </Button>
         </div>

         {/* Modal de información */}
         {showInfoModal && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
             <div className="bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 p-6 relative animate-fade-in">
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
         {/* Botón para mostrar información de análisis */}
         <div className="flex justify-end mb-8">
           <Button onClick={() => setShowInfoModal(true)} className="bg-yellow-400 text-black hover:bg-yellow-300 font-semibold px-6 py-2 rounded-lg shadow-lg">
             Información
           </Button>
         </div>

         {/* Modal de información */}
         {showInfoModal && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
             <div className="bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 p-6 relative animate-fade-in">
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
