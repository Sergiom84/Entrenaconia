/**
 * Modal de Referencia RIR (Repeticiones en Reserva)
 * Muestra tabla explicativa de qué significa cada valor de RIR
 */

import React from 'react';
import { X, Info, TrendingUp, AlertCircle } from 'lucide-react';

export default function RIRReferenceModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const rirData = [
    {
      rir: 0,
      label: 'Fallo Muscular',
      description: 'No puedes hacer ni una repetición más',
      color: 'bg-red-900/40 border-red-500/50 text-red-300',
      icon: '🔴',
      uso: 'Evitar en la mayoría de entrenamientos',
      rpe: 10
    },
    {
      rir: 1,
      label: '1 Rep en Reserva',
      description: 'Podrías hacer 1 repetición más',
      color: 'bg-orange-900/40 border-orange-500/50 text-orange-300',
      icon: '🟠',
      uso: 'Últimas series de ejercicios principales',
      rpe: 9
    },
    {
      rir: 2,
      label: '2 Reps en Reserva',
      description: 'Podrías hacer 2 repeticiones más',
      color: 'bg-green-900/40 border-green-500/50 text-green-300',
      icon: '🟢',
      uso: 'ZONA ÓPTIMA - Hipertrofia efectiva',
      rpe: 8
    },
    {
      rir: 3,
      label: '3 Reps en Reserva',
      description: 'Podrías hacer 3 repeticiones más',
      color: 'bg-green-900/40 border-green-500/50 text-green-300',
      icon: '🟢',
      uso: 'ZONA ÓPTIMA - Volumen sostenible',
      rpe: 7
    },
    {
      rir: 4,
      label: '4+ Reps en Reserva',
      description: 'Podrías hacer 4 o más repeticiones',
      color: 'bg-blue-900/40 border-blue-500/50 text-blue-300',
      icon: '🔵',
      uso: 'Calentamiento o técnica',
      rpe: '≤6'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-gray-700">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-t-2xl flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Info className="w-7 h-7" />
              Tabla de Referencia RIR
            </h2>
            <p className="text-blue-100 text-sm mt-1">
              Repeticiones en Reserva - Guía completa
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Introducción */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <h3 className="font-bold text-blue-300 flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5" />
              ¿Qué es RIR?
            </h3>
            <p className="text-gray-300 text-sm">
              <strong>RIR (Reps In Reserve)</strong> es el número de repeticiones que podrías hacer antes de llegar al fallo muscular. 
              Es una forma de medir la intensidad del esfuerzo sin necesidad de llegar al límite en cada serie.
            </p>
          </div>

          {/* Tabla de RIR */}
          <div className="space-y-3">
            <h3 className="font-bold text-white text-lg">Valores de RIR</h3>
            {rirData.map((item) => (
              <div
                key={item.rir}
                className={`border rounded-lg p-4 ${item.color}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{item.icon}</span>
                    <div>
                      <h4 className="font-bold text-lg">RIR {item.rir}</h4>
                      <p className="text-sm opacity-90">{item.label}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs opacity-75">RPE</div>
                    <div className="font-bold text-lg">{item.rpe}</div>
                  </div>
                </div>
                <p className="text-sm mb-2">{item.description}</p>
                <div className="bg-black/20 rounded px-3 py-2 text-xs">
                  <strong>Uso recomendado:</strong> {item.uso}
                </div>
              </div>
            ))}
          </div>

          {/* Recomendaciones */}
          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
            <h3 className="font-bold text-yellow-300 flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5" />
              Recomendaciones para Hipertrofia
            </h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">✓</span>
                <span><strong>RIR 2-3:</strong> Zona óptima para ganar músculo sin fatiga excesiva</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">✓</span>
                <span><strong>Primeras series:</strong> Puedes usar RIR 3-4 para acumular volumen</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">✓</span>
                <span><strong>Últimas series:</strong> RIR 1-2 para maximizar estímulo</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-1">✗</span>
                <span><strong>Evitar RIR 0:</strong> Aumenta fatiga sin beneficios adicionales</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

