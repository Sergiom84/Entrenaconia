import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';

export default function MethodologyCard({ methodology, manualActive, onDetails, onSelect }) {
  const Icon = methodology.icon;
  return (
    <Card
      className={`bg-black/80 border-gray-700 transition-all duration-300
        ${manualActive ? 'cursor-pointer hover:border-yellow-400/60 hover:scale-[1.01]' : 'hover:border-gray-600'}`}
      onClick={() => manualActive && onSelect(methodology)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {Icon && <Icon className="w-7 h-7 text-yellow-400" />}
            <CardTitle className="text-white text-xl">{methodology.name}</CardTitle>
          </div>
          <span className="text-xs px-2 py-1 border border-gray-600 text-gray-300 rounded">
            {methodology.level}
          </span>
        </div>
        <CardDescription className="text-gray-400 mt-2">{methodology.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Frecuencia:</span>
          <span className="text-white">{methodology.frequency}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Volumen:</span>
          <span className="text-white">{methodology.volume}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Intensidad:</span>
          <span className="text-white">{methodology.intensity}</span>
        </div>
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
            onClick={(e) => { e.stopPropagation(); onDetails(methodology); }}
          >
            Ver Detalles
          </Button>
          <Button
            disabled={!manualActive}
            className={`flex-1 ${manualActive ? 'bg-yellow-400 text-black hover:bg-yellow-300' : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}
            onClick={(e) => { e.stopPropagation(); if (manualActive) onSelect(methodology); }}
          >
            Seleccionar Metodología
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
