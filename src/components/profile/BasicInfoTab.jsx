import React from 'react'

// 1. Importa las tres tarjetas que acabamos de crear
import { BasicInfoCard } from './BasicInfoCard'
import { ExperienceCard } from './ExperienceCard'
import { PreferencesCard } from './PreferencesCard'

// 2. Este componente recibe todas las props y las pasa hacia abajo
export const BasicInfoTab = (props) => {
  return (
    <div className="space-y-6">
      {/* Usamos {...props} para pasar todas las propiedades (userProfile, editingSection,
        handleSave, etc.) a cada componente hijo de forma automática.
      */}
      <BasicInfoCard {...props} />
      <ExperienceCard {...props} />
      <PreferencesCard {...props} />
    </div>
  )
}
