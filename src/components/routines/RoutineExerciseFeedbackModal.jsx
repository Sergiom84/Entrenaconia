import React, { useState } from 'react';
import { X, Heart, Frown, Zap } from 'lucide-react';

const RoutineExerciseFeedbackModal = ({ show, exerciseName, onClose, onSubmit }) => {
  const [selectedSentiment, setSelectedSentiment] = useState(null);
  const [comment, setComment] = useState('');

  const handleSubmit = () => {
    if (selectedSentiment) {
      onSubmit({
        sentiment: selectedSentiment,
        comment: comment.trim() || null
      });
      // Reset form
      setSelectedSentiment(null);
      setComment('');
    }
  };

  const sentiments = [
    { id: 'love', label: 'Me encanta', icon: Heart, color: 'text-green-400', bgColor: 'bg-green-500/20', borderColor: 'border-green-400' },
    { id: 'neutral', label: 'Normal', icon: Zap, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', borderColor: 'border-yellow-400' },
    { id: 'hard', label: 'Es difícil', icon: Frown, color: 'text-red-400', bgColor: 'bg-red-500/20', borderColor: 'border-red-400' }
  ];

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-600 rounded-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-white">Valora el ejercicio</h3>
            <p className="text-sm text-gray-400 mt-1">{exerciseName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <h4 className="text-white font-medium mb-4">¿Cómo te ha parecido este ejercicio?</h4>
            <div className="grid grid-cols-1 gap-3">
              {sentiments.map((sentiment) => {
                const Icon = sentiment.icon;
                const isSelected = selectedSentiment === sentiment.id;
                
                return (
                  <button
                    key={sentiment.id}
                    onClick={() => setSelectedSentiment(sentiment.id)}
                    className={`flex items-center p-4 rounded-lg border-2 transition-all ${
                      isSelected 
                        ? `${sentiment.bgColor} ${sentiment.borderColor}` 
                        : 'bg-gray-700/30 border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <Icon 
                      size={24} 
                      className={`mr-3 ${
                        isSelected ? sentiment.color : 'text-gray-400'
                      }`} 
                    />
                    <span className={`font-medium ${
                      isSelected ? 'text-white' : 'text-gray-300'
                    }`}>
                      {sentiment.label}
                    </span>
                    {isSelected && (
                      <div className="ml-auto w-2 h-2 bg-yellow-400 rounded-full"></div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-6">
            <h4 className="text-white font-medium mb-3">Comentario adicional (opcional)</h4>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Comparte tu experiencia con este ejercicio..."
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 resize-none focus:border-yellow-400 focus:outline-none transition-colors"
              rows={3}
              maxLength={200}
            />
            <div className="text-xs text-gray-400 mt-1 text-right">
              {comment.length}/200
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedSentiment}
              className={`flex-1 font-semibold py-3 px-4 rounded-lg transition-colors ${
                selectedSentiment
                  ? 'bg-yellow-400 hover:bg-yellow-500 text-black'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoutineExerciseFeedbackModal;