/**
 * Modal de Tracking de Series - Hipertrofia V2
 * Registra peso, repeticiones y RIR por cada serie
 */

import React, { useState, useEffect } from 'react';
import { X, Check, TrendingUp, Info } from 'lucide-react';
import {
  validateSetData,
  calculateEstimated1RM,
  calculateRPE,
  calculateVolumeLoad,
  isEffectiveSet
} from '../config/progressionRules';

export default function SeriesTrackingModal({
  exerciseName,
  exerciseId,
  seriesNumber,
  totalSeries,
  previousPR = null,
  suggestedWeight = null,
  onSave,
  onClose
}) {
  const [weight, setWeight] = useState(suggestedWeight || '');
  const [reps, setReps] = useState('');
  const [rir, setRir] = useState(2); // Default RIR 2 (óptimo)
  const [errors, setErrors] = useState([]);

  // Cálculos en tiempo real
  const [calculations, setCalculations] = useState({
    estimated1RM: 0,
    rpe: 0,
    volumeLoad: 0,
    isEffective: false
  });

  // Actualizar cálculos cuando cambian los valores
  useEffect(() => {
    if (weight && reps) {
      const w = parseFloat(weight);
      const r = parseInt(reps);

      setCalculations({
        estimated1RM: calculateEstimated1RM(w, r, rir),
        rpe: calculateRPE(rir),
        volumeLoad: calculateVolumeLoad(w, r),
        isEffective: isEffectiveSet(rir)
      });
    }
  }, [weight, reps, rir]);

  const handleSave = () => {
    // Validar datos
    const validation = validateSetData(
      parseFloat(weight),
      parseInt(reps),
      rir
    );

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    // 🐛 Debug: Verificar exerciseId recibido
    console.log('🔍 DEBUG SeriesTrackingModal - exerciseId recibido:', exerciseId);
    console.log('🔍 DEBUG SeriesTrackingModal - exerciseName:', exerciseName);

    // Preparar datos
    const setData = {
      exercise_id: exerciseId,
      exercise_name: exerciseName,
      set_number: seriesNumber,
      weight_used: parseFloat(weight),
      reps_completed: parseInt(reps),
      rir_reported: rir,
      ...calculations
    };

    console.log('🔍 DEBUG SeriesTrackingModal - setData preparado:', setData);

    onSave(setData);
  };

  const getRIRColor = (rirValue) => {
    if (rirValue <= 1) return 'text-red-400';
    if (rirValue >= 2 && rirValue <= 3) return 'text-green-400';
    return 'text-blue-400';
  };

  const getRIRLabel = (rirValue) => {
    if (rirValue === 0) return 'Fallo muscular';
    if (rirValue === 1) return '1 más posible';
    if (rirValue === 2) return '2 más posibles (Óptimo)';
    if (rirValue === 3) return '3 más posibles (Óptimo)';
    return '4+ más posibles';
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
      <div className="bg-gray-900 rounded-xl w-full max-w-md border border-yellow-400/30">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-600 to-orange-600 p-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-lg">
                📊 Registrar Serie {seriesNumber}/{totalSeries}
              </h3>
              <p className="text-yellow-100 text-sm">{exerciseName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Sugerencia de peso si existe */}
          {suggestedWeight && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-start gap-2">
              <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-blue-300 font-semibold">Peso sugerido:</p>
                <p className="text-gray-300">
                  {suggestedWeight} kg (80% de tu PR: {previousPR} kg)
                </p>
              </div>
            </div>
          )}

          {/* Input: Peso */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Peso Utilizado (kg)
            </label>
            <input
              type="number"
              step="0.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-yellow-400 focus:outline-none text-lg"
              placeholder="75.0"
              autoFocus
            />
          </div>

          {/* Input: Repeticiones */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Repeticiones Completadas
            </label>
            <input
              type="number"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-yellow-400 focus:outline-none text-lg"
              placeholder="10"
            />
          </div>

          {/* Selector: RIR */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              RIR (Repeticiones en Reserva)
            </label>
            <div className="grid grid-cols-5 gap-2 mb-2">
              {[0, 1, 2, 3, 4].map(value => (
                <button
                  key={value}
                  onClick={() => setRir(value)}
                  className={`py-3 rounded-lg font-bold transition-all ${
                    rir === value
                      ? 'bg-yellow-400 text-gray-900 scale-105'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
            <p className={`text-sm font-medium ${getRIRColor(rir)}`}>
              {getRIRLabel(rir)}
            </p>
          </div>

          {/* Cálculos en tiempo real */}
          {weight && reps && (
            <div className="bg-gray-800/50 rounded-lg p-4 space-y-2 border border-gray-700">
              <p className="text-xs text-gray-400 font-semibold uppercase">Cálculos Automáticos</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-400">1RM Estimado:</p>
                  <p className="text-white font-bold">{calculations.estimated1RM.toFixed(1)} kg</p>
                </div>
                <div>
                  <p className="text-gray-400">RPE:</p>
                  <p className="text-white font-bold">{calculations.rpe}/10</p>
                </div>
                <div>
                  <p className="text-gray-400">Volumen:</p>
                  <p className="text-white font-bold">{calculations.volumeLoad} kg</p>
                </div>
                <div>
                  <p className="text-gray-400">Estado:</p>
                  <p className={calculations.isEffective ? 'text-green-400 font-bold' : 'text-gray-400'}>
                    {calculations.isEffective ? '✓ Efectiva' : '○ Revisar'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Errores */}
          {errors.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              {errors.map((error, index) => (
                <p key={index} className="text-red-400 text-sm">• {error}</p>
              ))}
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!weight || !reps}
              className="flex-1 py-3 bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              Guardar Serie
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
