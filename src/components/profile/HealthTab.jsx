import React from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Save, Pencil } from 'lucide-react'
import { EditableField } from '../EditableField'
import { MedicalDocsCard } from './MedicalDocsCard'

export const HealthTab = (props) => {
  const {
    userProfile,
    setUserProfile,
    editingSection,
    editedData,
    startEdit,
    handleSave,
    handleCancel,
    handleInputChange,
    alergiasList,
    medicamentosList,
    alergiasObjList,
    medicamentosObjList
  } = props

  const isEditing = editingSection === 'health'

  return (
    <div className="space-y-6">
      {/* Componente de documentación médica */}
      <MedicalDocsCard
        userProfile={userProfile}
        setUserProfile={setUserProfile}
      />

      {/* Tarjeta de alergias y medicamentos */}
      <Card className="bg-gray-900 border-yellow-400/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <span>Alergias y Medicamentos</span>
            <div className="flex items-center gap-2">
              {isEditing
                ? (
                <>
                  <Button onClick={handleSave} size="sm" className="bg-green-500 hover:bg-green-600 text-white">
                    <Save className="w-4 h-4 mr-1" /> Guardar
                  </Button>
                  <Button onClick={handleCancel} size="sm" variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                    Cancelar
                  </Button>
                </>
                  )
                : (
                <button
                  onClick={() => {
                    startEdit('health', {
                      alergias: [...alergiasList],
                      medicamentos: [...medicamentosList]
                    })
                  }}
                  disabled={!!(editingSection && editingSection !== 'health')}
                  className="p-2 text-gray-400 hover:text-yellow-400 transition-colors"
                  title="Editar alergias y medicamentos"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                  )}
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <EditableField
            label="Alergias"
            field="alergias"
            editing={isEditing}
            isList={true}
            value={alergiasList}
            editedData={editedData}
            onInputChange={handleInputChange}
            displayObjects={alergiasObjList}
            {...props}
          />

          <EditableField
            label="Medicamentos"
            field="medicamentos"
            editing={isEditing}
            isList={true}
            value={medicamentosList}
            editedData={editedData}
            onInputChange={handleInputChange}
            displayObjects={medicamentosObjList}
            {...props}
          />
        </div>
      </CardContent>
    </Card>
    </div>
  )
}
