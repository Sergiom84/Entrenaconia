import React, { useMemo } from 'react';
import { User, Scale, Ruler, Target, Activity } from 'lucide-react';
import { useProfileState } from '../../../hooks/useProfileState';

/**
 * Display del perfil de usuario en el resumen - MIGRADO A SUPABASE
 * Muestra información del usuario sincronizada con la base de datos
 *
 * MIGRADO: Ahora usa useProfileState que:
 * - Lee localStorage para respuesta inmediata
 * - Fetch automático desde Supabase (/api/users/:id)
 * - Sincronización BD → localStorage automática
 * - Datos completos (40+ campos vs 5 anteriores)
 * - Autenticación JWT para seguridad
 */
export const UserProfileDisplay = () => {
  const { userProfile, calculateIMC, getIMCCategory } = useProfileState();

  // Procesar datos de perfil de forma segura desde useProfileState
  const profileData = useMemo(() => {
    if (!userProfile) {
      return {
        edad: '—',
        peso: '—',
        altura: '—',
        nivel: '—',
        imc: '—',
        imcCategoria: 'No disponible'
      };
    }

    // Calcular IMC usando la función del hook
    const imc = calculateIMC(userProfile.peso, userProfile.altura);
    const imcCategoria = getIMCCategory(imc);

    return {
      edad: userProfile.edad ? `${userProfile.edad}` : '—',
      peso: userProfile.peso ? `${Number(userProfile.peso).toFixed(1)} kg` : '—',
      altura: userProfile.altura ? `${userProfile.altura} cm` : '—',
      nivel: userProfile.nivel || '—',
      imc: imc ? `${imc}` : '—',
      imcCategoria: imcCategoria || 'No disponible'
    };
  }, [userProfile, calculateIMC, getIMCCategory]);

  // Estados de carga - useProfileState carga inmediatamente desde localStorage
  // Si no hay userProfile, significa que no está logueado o no tiene perfil
  if (!userProfile || (userProfile && Object.keys(userProfile).length === 0)) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
        <User className="w-3 h-3" />
        <span>Perfil no disponible</span>
      </div>
    );
  }

  const { edad, peso, altura, nivel, imc, imcCategoria } = profileData;

  return (
    <div className="mb-4">
      {/* Header del perfil */}
      <div className="flex items-center gap-2 mb-2">
        <User className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-medium text-gray-300">Perfil del Usuario</h3>
      </div>

      {/* Grid de información del perfil */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
        {/* Edad */}
        <div className="flex items-center gap-1 text-gray-400">
          <Target className="w-3 h-3 flex-shrink-0" />
          <div>
            <div className="text-gray-500">Edad</div>
            <div className="text-gray-300 font-medium">{edad}</div>
          </div>
        </div>

        {/* Peso */}
        <div className="flex items-center gap-1 text-gray-400">
          <Scale className="w-3 h-3 flex-shrink-0" />
          <div>
            <div className="text-gray-500">Peso</div>
            <div className="text-gray-300 font-medium">{peso}</div>
          </div>
        </div>

        {/* Altura */}
        <div className="flex items-center gap-1 text-gray-400">
          <Ruler className="w-3 h-3 flex-shrink-0" />
          <div>
            <div className="text-gray-500">Altura</div>
            <div className="text-gray-300 font-medium">{altura}</div>
          </div>
        </div>

        {/* Nivel */}
        <div className="flex items-center gap-1 text-gray-400">
          <Activity className="w-3 h-3 flex-shrink-0" />
          <div>
            <div className="text-gray-500">Nivel</div>
            <div className="text-gray-300 font-medium">{nivel}</div>
          </div>
        </div>

        {/* IMC */}
        <div className="flex items-center gap-1 text-gray-400 col-span-2 md:col-span-1">
          <div className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0" />
          <div>
            <div className="text-gray-500">IMC</div>
            <div className="text-gray-300 font-medium">
              {imc}
              {imc !== '—' && (
                <span className="text-gray-500 ml-1 text-xs">({imcCategoria})</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfileDisplay;