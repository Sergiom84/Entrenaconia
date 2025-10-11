import React from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Settings } from 'lucide-react'

export const SettingsTab = () => {
  // Por ahora, este componente es estático y no necesita props.
  return (
    <Card className="bg-gray-900 border-yellow-400/20">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <Settings className="mr-2 text-yellow-400" /> Configuración de
          Cuenta
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-yellow-400">
            Cambiar Contraseña
          </h3>
          <p className="text-gray-400">
            Esta funcionalidad estará disponible próximamente.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
