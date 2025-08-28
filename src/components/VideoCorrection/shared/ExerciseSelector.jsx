import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle } from 'lucide-react';

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
];

export default function ExerciseSelector({ selectedExerciseId, onExerciseChange }) {
  const [exercises, setExercises] = useState(FALLBACK_EXERCISES);

  // Cargar biblioteca de ejercicios desde el backend
  useEffect(() => {
    const loadExercises = async () => {
      try {
        const res = await fetch('/api/exercises?limit=500');
        if (res.ok) {
          const data = await res.json();
          // Mapeamos al esquema esperado
          const mapped = (data?.items || data || []).map((e) => ({
            id: e.id || e.slug || e.code || crypto.randomUUID(),
            name: e.name || e.titulo || 'Ejercicio',
            commonErrors: e.common_errors || e.errores || [],
            keyPoints: e.key_points || e.puntos_clave || [],
          }));
          if (mapped.length) setExercises(mapped);
        }
      } catch (e) {
        console.warn('Usando ejercicios fallback - API no disponible:', e.message);
      }
    };
    loadExercises();
  }, []);

  const selectedExercise = exercises.find((e) => e.id === selectedExerciseId) || exercises[0];

  return (
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
              onClick={() => onExerciseChange(ex.id)}
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
  );
}