import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  Brain
} from 'lucide-react'

const VideoCorrectionSection = () => {
  const [isRecording, setIsRecording] = useState(false)
  const [selectedExercise, setSelectedExercise] = useState('squat')
  const [showAdvancedIA, setShowAdvancedIA] = useState(false)
  const { user } = useAuth()
  const { userData } = useUserContext()

  // Datos de ejemplo para video corrección (se conectaría con el backend más adelante)
  const videoCorreccion = {
    precisionPromedio: '87%',
    sesionesAnalizadas: 15,
    reduccionErrores: '34%',
    ejerciciosDominados: 8,
    mejoras: ['Mejor alineación en sentadillas', 'Mayor control excéntrico'],
    erroresComunes: ['Rodillas hacia adentro en peso muerto']
  }

  // Si se activa el modo avanzado, podríamos mostrar una nueva pantalla
  // if (showAdvancedIA) {
  //   return <VideoCorrectionScreen />
  // }

  const analysisFeatures = [
    {
      title: 'Análisis Postural en Tiempo Real',
      description: 'Detección instantánea de desalineaciones y compensaciones',
      icon: <Eye className="w-6 h-6 text-blue-400" />,
      accuracy: '95%',
      details: [
        'Análisis de 33 puntos corporales clave',
        'Detección de asimetrías posturales',
        'Evaluación de la cadena cinética',
        'Corrección de compensaciones musculares'
      ]
    },
    {
      title: 'Evaluación de Rango de Movimiento',
      description: 'Medición precisa de ángulos articulares y amplitud',
      icon: <Target className="w-6 h-6 text-green-400" />,
      accuracy: '92%',
      details: [
        'Medición de flexión/extensión articular',
        'Evaluación de movilidad específica',
        'Detección de limitaciones funcionales',
        'Progresión de flexibilidad'
      ]
    },
    {
      title: 'Control de Tempo y Ritmo',
      description: 'Análisis de velocidad de ejecución y control excéntrico',
      icon: <Clock className="w-6 h-6 text-yellow-400" />,
      accuracy: '89%',
      details: [
        'Medición de fase concéntrica/excéntrica',
        'Control de tiempo bajo tensión',
        'Evaluación de estabilidad',
        'Optimización del tempo'
      ]
    },
    {
      title: 'Reconocimiento de Ejercicios',
      description: 'Identificación automática del ejercicio realizado',
      icon: <Zap className="w-6 h-6 text-purple-400" />,
      accuracy: '97%',
      details: [
        'Base de datos de +500 ejercicios',
        'Detección de variaciones',
        'Corrección de ejercicio incorrecto',
        'Sugerencias de alternativas'
      ]
    }
  ]

  const exerciseLibrary = {
    squat: {
      name: 'Sentadilla',
      commonErrors: [
        'Rodillas hacia adentro (valgo)',
        'Inclinación excesiva del torso',
        'Falta de profundidad',
        'Peso en puntas de pies'
      ],
      keyPoints: [
        'Mantener rodillas alineadas con pies',
        'Descender hasta 90° de flexión',
        'Mantener pecho erguido',
        'Distribuir peso en talones'
      ]
    },
    deadlift: {
      name: 'Peso Muerto',
      commonErrors: [
        'Espalda redondeada',
        'Barra alejada del cuerpo',
        'Hiperextensión lumbar',
        'Rodillas bloqueadas prematuramente'
      ],
      keyPoints: [
        'Mantener columna neutra',
        'Barra pegada al cuerpo',
        'Activar glúteos en la subida',
        'Extensión simultánea cadera-rodilla'
      ]
    },
    pushup: {
      name: 'Flexión de Brazos',
      commonErrors: [
        'Cadera elevada o hundida',
        'Rango de movimiento incompleto',
        'Manos mal posicionadas',
        'Cabeza hacia adelante'
      ],
      keyPoints: [
        'Línea recta cabeza-talones',
        'Descender hasta tocar suelo',
        'Manos bajo hombros',
        'Mirada al suelo'
      ]
    }
  }

  const feedbackTypes = [
    {
      type: 'Visual',
      description: 'Indicadores en pantalla y overlay de corrección',
      color: 'text-blue-400',
      examples: ['Líneas de alineación', 'Zonas de color', 'Ángulos en tiempo real']
    },
    {
      type: 'Auditivo',
      description: 'Comandos de voz y señales sonoras',
      color: 'text-green-400',
      examples: ['Correcciones habladas', 'Conteo de repeticiones', 'Alertas de error']
    },
    {
      type: 'Háptico',
      description: 'Vibraciones del dispositivo para correcciones',
      color: 'text-yellow-400',
      examples: ['Vibración por error', 'Pulsos de tempo', 'Confirmación de rep']
    }
  ]

  return (
    <div className="min-h-screen bg-black text-white p-6 pb-24">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-yellow-400 to-yellow-200 bg-clip-text text-transparent">
            Corrección por Video IA
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Análisis de técnica en tiempo real con feedback inmediato para optimizar 
            tu forma y prevenir lesiones durante el entrenamiento.
          </p>
        </div>

        {/* Demo de Grabación */}
        <Card className="bg-black/80 border-yellow-400/20 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Camera className="w-5 h-5 mr-2 text-yellow-400" />
              Demo de Corrección en Vivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="aspect-video bg-gray-800/50 rounded-lg flex items-center justify-center mb-4 relative">
              {isRecording ? (
                <div className="text-center">
                  <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mb-4 animate-pulse">
                    <Camera className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-white">Analizando movimiento...</p>
                  <div className="absolute top-4 right-4 flex space-x-2">
                    <Badge className="bg-green-500">Postura: ✓</Badge>
                    <Badge className="bg-yellow-500">ROM: 85%</Badge>
                    <Badge className="bg-red-500">Tempo: Lento</Badge>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <Camera className="w-16 h-16 text-gray-600 mb-4" />
                  <p className="text-gray-400">Toca grabar para comenzar el análisis</p>
                </div>
              )}
            </div>
            
            <div className="flex justify-center space-x-4">
              <Button 
                onClick={() => setIsRecording(!isRecording)}
                className={isRecording ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
              >
                {isRecording ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                {isRecording ? 'Detener' : 'Comenzar'} Análisis
              </Button>
              <Button variant="outline" className="border-yellow-400 text-yellow-400 hover:bg-yellow-400/10">
                <Settings className="w-4 h-4 mr-2" />
                Configurar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Características de Análisis */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {analysisFeatures.map((feature, index) => (
            <Card key={index} className="bg-black/80 border-yellow-400/20 hover:border-yellow-400/40 transition-colors">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {feature.icon}
                    <div>
                      <CardTitle className="text-white text-lg">{feature.title}</CardTitle>
                      <CardDescription className="text-gray-400">{feature.description}</CardDescription>
                    </div>
                  </div>
                  <Badge className="bg-green-500 text-white">{feature.accuracy}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {feature.details.map((detail, idx) => (
                    <li key={idx} className="flex items-center space-x-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-gray-300">{detail}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Selector de Ejercicio */}
        <Card className="bg-black/80 border-yellow-400/20 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Biblioteca de Ejercicios</CardTitle>
            <CardDescription className="text-gray-400">
              Selecciona un ejercicio para ver los puntos clave de análisis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-4 mb-6 flex-wrap gap-2">
              {Object.entries(exerciseLibrary).map(([key, exercise]) => (
                <Button
                  key={key}
                  variant={selectedExercise === key ? "default" : "outline"}
                  onClick={() => setSelectedExercise(key)}
                  className={selectedExercise === key ? 
                    "bg-yellow-400 text-black hover:bg-yellow-300" : 
                    "border-yellow-400/50 text-yellow-400 hover:border-yellow-400 hover:bg-yellow-400/10"
                  }
                >
                  {exercise.name}
                </Button>
              ))}
            </div>
            
            {selectedExercise && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-white font-semibold mb-3 flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2 text-red-400" />
                    Errores Comunes Detectados
                  </h4>
                  <ul className="space-y-2">
                    {exerciseLibrary[selectedExercise].commonErrors.map((error, idx) => (
                      <li key={idx} className="flex items-center space-x-2 text-sm">
                        <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                        <span className="text-gray-300">{error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="text-white font-semibold mb-3 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-400" />
                    Puntos Clave Monitoreados
                  </h4>
                  <ul className="space-y-2">
                    {exerciseLibrary[selectedExercise].keyPoints.map((point, idx) => (
                      <li key={idx} className="flex items-center space-x-2 text-sm">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        <span className="text-gray-300">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tipos de Feedback */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {feedbackTypes.map((feedback, index) => (
            <Card key={index} className="bg-black/80 border-yellow-400/20 hover:border-yellow-400/40 transition-colors">
              <CardHeader>
                <CardTitle className={`${feedback.color} text-lg`}>{feedback.type}</CardTitle>
                <CardDescription className="text-gray-400">{feedback.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {feedback.examples.map((example, idx) => (
                    <li key={idx} className="text-sm text-gray-300 flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${feedback.color.replace('text-', 'bg-')}`}></div>
                      <span>{example}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Estadísticas y Progreso */}
        <Card className="bg-black/80 border-yellow-400/20 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-yellow-400" />
              Progreso de Técnica
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{videoCorreccion.precisionPromedio}</div>
                <div className="text-sm text-gray-400">Precisión Promedio</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">{videoCorreccion.sesionesAnalizadas}</div>
                <div className="text-sm text-gray-400">Sesiones Analizadas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">{videoCorreccion.reduccionErrores}</div>
                <div className="text-sm text-gray-400">Reducción de Errores</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">{videoCorreccion.ejerciciosDominados}</div>
                <div className="text-sm text-gray-400">Ejercicios Dominados</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alertas del Sistema - Dinámicas */}
        <div className="space-y-4 mb-8">
          {videoCorreccion.mejoras && videoCorreccion.mejoras.length > 0 && (
            <Alert className="border-green-400/30 bg-green-400/10">
              <CheckCircle className="h-4 w-4 text-green-400" />
              <AlertDescription className="text-green-300">
                <strong>Mejoras Detectadas:</strong> {videoCorreccion.mejoras.join(', ')}.
              </AlertDescription>
            </Alert>
          )}

          {videoCorreccion.erroresComunes && videoCorreccion.erroresComunes.length > 0 && (
            <Alert className="border-yellow-400/30 bg-yellow-400/10">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-yellow-300">
                <strong>Puntos de Atención:</strong> {videoCorreccion.erroresComunes.join(', ')}.
              </AlertDescription>
            </Alert>
          )}

          {/* Alerta personalizada según nivel del usuario */}
          {userData?.nivel === 'principiante' && (
            <Alert className="border-blue-400/30 bg-blue-400/10">
              <CheckCircle className="h-4 w-4 text-blue-400" />
              <AlertDescription className="text-blue-300">
                <strong>Consejo para Principiantes:</strong> Enfócate en dominar la técnica básica antes de aumentar la intensidad. ¡Vas muy bien!
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="text-center space-y-4">
          <Button
            className="bg-yellow-400 text-black hover:bg-yellow-300 px-8 py-3 font-semibold"
            onClick={() => setShowAdvancedIA(true)}
          >
            <Brain className="w-5 h-5 mr-2" />
            Activar Corrección IA Avanzada
          </Button>

          <div className="flex justify-center">
            <Alert className="border-green-400/30 bg-green-400/10 max-w-md">
              <ExternalLink className="w-4 h-4 text-green-400" />
              <AlertDescription className="text-green-300 text-sm">
                <strong>¡Nuevo!</strong> Análisis en tiempo real con MediaPipe + GPT-4o.
                Feedback instantáneo y personalizado.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VideoCorrectionSection
