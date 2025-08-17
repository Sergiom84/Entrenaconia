import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Activity, Save, Pencil, Calculator } from 'lucide-react'
import { EditableField } from '../EditableField'
import { BodyCompositionCalculator } from './BodyCompositionCalculator'

export const BodyCompositionCard = (props) => {
  const {
    userProfile,
    editingSection,
    editedData,
    startEdit,
    handleSave,
    handleCancel,
    handleInputChange,
    setUserProfile
  } = props

  const [showCalculator, setShowCalculator] = useState(false)
  const isEditing = editingSection === 'bodyComp'

  const handleCalculatorResults = (results) => {
    // Calcular agua corporal (estimación: 60% para hombres, 55% para mujeres)
    const aguaCorporal = userProfile.sexo === 'masculino' ? 60 : 55

    // Calcular metabolismo basal usando la fórmula Harris-Benedict
    let metabolismoBasal
    if (userProfile.sexo === 'masculino') {
      metabolismoBasal = 88.362 + (13.397 * userProfile.peso) + (4.799 * userProfile.altura) - (5.677 * userProfile.edad)
    } else {
      metabolismoBasal = 447.593 + (9.247 * userProfile.peso) + (3.098 * userProfile.altura) - (4.330 * userProfile.edad)
    }

    // Actualizar el perfil con los resultados calculados
    setUserProfile(prev => ({
      ...prev,
      grasa_corporal: results.porcentaje_grasa,
      masa_muscular: results.masa_magra,
      agua_corporal: aguaCorporal,
      metabolismo_basal: Math.round(metabolismoBasal)
    }))
  }

  return (
    <Card className="bg-gray-900 border-yellow-400/20">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center">
            <Activity className="mr-2 text-yellow-400" /> Composición
            Corporal Detallada
          </div>
          <div className="flex items-center gap-2">
            {isEditing
              ? (
              <>
                <Button
                  onClick={handleSave}
                  size="sm"
                  className="bg-green-500 hover:bg-green-600 text-white"
                >
                  <Save className="w-4 h-4 mr-1" />
                  Guardar
                </Button>
                <Button
                  onClick={handleCancel}
                  size="sm"
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  Cancelar
                </Button>
              </>
                )
              : (
              <button
                onClick={() =>
                  startEdit('bodyComp', {
                    grasa_corporal: userProfile.grasa_corporal,
                    masa_muscular: userProfile.masa_muscular,
                    agua_corporal: userProfile.agua_corporal,
                    metabolismo_basal: userProfile.metabolismo_basal
                  })
                }
                disabled={editingSection && editingSection !== 'bodyComp'}
                className="p-2 text-gray-400 hover:text-yellow-400 transition-colors"
                title="Editar composición corporal"
              >
                <Pencil className="w-4 h-4" />
              </button>
                )}
            {/* Botón para abrir el modal de cálculo */}
            {!isEditing && (
              <Button
                size="sm"
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
                onClick={() => setShowCalculator(true)}
                title="Calcular automáticamente"
              >
                <Calculator className="w-4 h-4 mr-1" /> Calcular
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <EditableField
            label="Grasa Corporal"
            field="grasa_corporal"
            value={userProfile.grasa_corporal}
            type="number"
            suffix="%"
            editing={isEditing}
            editedData={editedData}
            onInputChange={handleInputChange}
          />
          <EditableField
            label="Masa Muscular"
            field="masa_muscular"
            value={userProfile.masa_muscular}
            type="number"
            suffix=" kg"
            editing={isEditing}
            editedData={editedData}
            onInputChange={handleInputChange}
          />
          <EditableField
            label="Agua Corporal"
            field="agua_corporal"
            value={userProfile.agua_corporal}
            type="number"
            suffix="%"
            editing={isEditing}
            editedData={editedData}
            onInputChange={handleInputChange}
          />
          <EditableField
            label="Metabolismo Basal"
            field="metabolismo_basal"
            value={userProfile.metabolismo_basal}
            type="number"
            suffix=" kcal"
            editing={isEditing}
            editedData={editedData}
            onInputChange={handleInputChange}
          />
        </div>
      </CardContent>

      {/* Calculadora modal */}
      <BodyCompositionCalculator
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)}
        onCalculate={handleCalculatorResults}
      />
    </Card>
  )
}
