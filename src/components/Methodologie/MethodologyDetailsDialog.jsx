import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Play } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';

export default function MethodologyDetailsDialog({ open, onOpenChange, detailsMethod, selectionMode, onClose, onSelect }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-black/95 border-yellow-400/20 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center">
            {detailsMethod?.icon && React.createElement(detailsMethod.icon, { className: 'w-6 h-6 mr-3 text-yellow-400' })}
            {detailsMethod?.name || 'Detalles'}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Información completa de la metodología seleccionada.
          </DialogDescription>
        </DialogHeader>
        {detailsMethod && (
          <div className="space-y-6">
            {detailsMethod.detailedDescription && (
              <div className="p-4 bg-gray-800/50 rounded-lg">
                <h4 className="text-yellow-400 font-semibold mb-2">Descripción Completa</h4>
                <p className="text-gray-300 text-sm leading-relaxed">
                  {detailsMethod.detailedDescription}
                </p>
              </div>
            )}
            {detailsMethod.videoPlaceholder && (
              <div className="p-6 bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-600 text-center">
                <Play className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
                <h4 className="text-white font-semibold mb-2">Video Explicativo</h4>
                <p className="text-gray-400 text-sm">
                  Próximamente: Video detallado sobre la metodología {detailsMethod.name}
                </p>
              </div>
            )}
            <Tabs defaultValue="principles" className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-gray-800">
                <TabsTrigger value="principles" className="text-xs">Principios</TabsTrigger>
                <TabsTrigger value="benefits" className="text-xs">Beneficios</TabsTrigger>
                <TabsTrigger value="target" className="text-xs">Dirigido a</TabsTrigger>
                <TabsTrigger value="science" className="text-xs">Ciencia</TabsTrigger>
              </TabsList>
              <TabsContent value="principles" className="mt-4">
                <h4 className="text-yellow-400 font-semibold mb-2">Principios Fundamentales</h4>
                <ul className="space-y-1">
                  {detailsMethod.principles?.map((principle, idx) => (
                    <li key={idx} className="text-gray-300 text-sm flex items-start">
                      <span className="text-yellow-400 mr-2">•</span>
                      {principle}
                    </li>
                  )) || <li className="text-gray-400 text-sm">No hay principios disponibles</li>}
                </ul>
              </TabsContent>
              <TabsContent value="benefits" className="mt-4">
                <h4 className="text-yellow-400 font-semibold mb-2">Beneficios Principales</h4>
                <ul className="space-y-1">
                  {detailsMethod.benefits?.map((benefit, idx) => (
                    <li key={idx} className="text-gray-300 text-sm flex items-start">
                      <span className="text-green-400 mr-2">✓</span>
                      {benefit}
                    </li>
                  )) || <li className="text-gray-400 text-sm">No hay beneficios disponibles</li>}
                </ul>
              </TabsContent>
              <TabsContent value="target" className="mt-4">
                <h4 className="text-yellow-400 font-semibold mb-2">Público Objetivo</h4>
                <p className="text-gray-300 text-sm">{detailsMethod.targetAudience || 'No especificado'}</p>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <span className="text-gray-400 text-xs">Duración por sesión:</span>
                    <p className="text-white text-sm">{detailsMethod.duration || 'No especificado'}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs">Duración del programa:</span>
                    <p className="text-white text-sm">{detailsMethod.programDuration}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs">Frecuencia:</span>
                    <p className="text-white text-sm">{detailsMethod.frequency}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs">Compatible con casa:</span>
                    <p className="text-white text-sm">{detailsMethod.homeCompatible ? 'Sí' : 'No'}</p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="science" className="mt-4">
                <h4 className="text-yellow-400 font-semibold mb-2">Base Científica</h4>
                <p className="text-gray-300 text-sm">{detailsMethod.scientificBasis || 'No especificado'}</p>
              </TabsContent>
            </Tabs>
          </div>
        )}
        <DialogFooter className="flex justify-between items-center mt-6 pt-4 border-t border-gray-700">
          <div className="flex items-center space-x-2">
            <span className="px-2 py-1 bg-yellow-400/20 text-yellow-400 text-xs rounded">
              {detailsMethod?.focus || 'General'}
            </span>
            <span className="px-2 py-1 bg-blue-400/20 text-blue-400 text-xs rounded">
              {detailsMethod?.level || 'Todos los niveles'}
            </span>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
            <Button
              className={`flex-1 ${
                selectionMode === 'manual'
                  ? 'bg-yellow-400 text-black hover:bg-yellow-300'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
              disabled={selectionMode !== 'manual'}
              onClick={() => {
                if (selectionMode === 'manual' && detailsMethod) {
                  onClose();
                  onSelect(detailsMethod);
                }
              }}
            >
              Seleccionar Metodología
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
