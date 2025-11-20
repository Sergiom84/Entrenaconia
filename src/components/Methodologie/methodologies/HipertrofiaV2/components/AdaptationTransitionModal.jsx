import React from 'react';
import { CheckCircle, X } from 'lucide-react';

export default function AdaptationTransitionModal({ show, onClose, onConfirm, block }) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-green-400" />
            <h3 className="text-white font-semibold text-lg">Listo para D1–D5</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-300">
          Has completado los criterios de la fase de adaptación. ¿Quieres generar tu plan HipertrofiaV2 D1–D5 ahora?
        </p>

        {block && (
          <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3 text-sm text-gray-200">
            <p>Bloque: {block.blockType === 'half_body' ? 'Half Body' : 'Full Body'}</p>
            <p>Semanas: {block.weeksTracked ?? block.durationWeeks ?? '-'} / {block.durationWeeks ?? '-'}</p>
            <p>Estado: {block.status}</p>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
          >
            Luego
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold"
          >
            Generar D1–D5
          </button>
        </div>
      </div>
    </div>
  );
}
