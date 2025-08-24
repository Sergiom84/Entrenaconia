import React, { useState } from 'react';
import { Star, X } from 'lucide-react';

// Reutilizable para Rutinas. Basado en HomeTraining/ExerciseFeedbackModal.jsx
const feedbackOptions = [
  { key: 'dislike', label: 'No me gusta' },
  { key: 'hard', label: 'Es difícil' },
  { key: 'love', label: 'Me ha encantado' },
];

export default function ExerciseFeedbackModal({ show, onClose, onSubmit, exerciseName }) {
  const [selected, setSelected] = useState(null);
  const [comment, setComment] = useState('');

  if (!show) return null;

  const handleSubmit = () => {
    if (!selected && !comment.trim()) {
      onClose?.();
      return;
    }
    onSubmit?.({ sentiment: selected, comment: comment.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#0d1522] border border-yellow-400/20 rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Star className="text-yellow-400" />
            <h3 className="text-white font-semibold">¿Cómo has sentido este ejercicio?</h3>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-gray-400 mb-3">{exerciseName}</p>

        <div className="grid grid-cols-1 gap-2 mb-4">
          {feedbackOptions.map(opt => (
            <label key={opt.key} className={`flex items-center gap-2 p-2 rounded-md cursor-pointer border ${selected===opt.key ? 'border-yellow-400 bg-yellow-400/10' : 'border-gray-700'}`}>
              <input
                type="radio"
                name="exercise-feedback"
                className="accent-yellow-400"
                checked={selected === opt.key}
                onChange={() => setSelected(opt.key)}
              />
              <span className="text-gray-200">{opt.label}</span>
            </label>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Comentarios (opcional)"
          className="w-full bg-gray-800 border border-gray-700 rounded-md p-2 text-sm text-white placeholder-gray-500 mb-4"
          rows={3}
        />

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-300 hover:text-white">Cancelar</button>
          <button onClick={handleSubmit} className="px-4 py-2 text-sm bg-yellow-400 hover:bg-yellow-500 text-black font-semibold rounded-md">Guardar</button>
        </div>
      </div>
    </div>
  );
}

