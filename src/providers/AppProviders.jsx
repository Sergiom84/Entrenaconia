/**
 * 🏗️ AppProviders - Composición de Todos los Providers
 *
 * ESTRUCTURA:
 * AppProviders (wrapper principal)
 * ├── DebugProvider (debugging automático)
 * ├── TraceProvider (rastreo de eventos)
 * ├── AuthProvider (autenticación)
 * ├── UserProvider (datos de usuario)
 * └── WorkoutProvider (estado de entrenamientos)
 *
 * BENEFICIOS:
 * - Un único lugar para gestionar todos los providers
 * - Debugging automático sin modificar componentes
 * - Orden correcto de providers (respeta dependencias)
 * - Fácil agregar nuevos providers
 */

import { DebugProvider, useContextDebug } from './DebugProvider';
import { TraceProvider } from '@/contexts/TraceContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { UserProvider } from '@/contexts/UserContext';
import { WorkoutProvider } from '@/contexts/WorkoutContext';

/**
 * 🎯 AppProviders - Wrapper unificado
 */
export const AppProviders = ({ children }) => {
  return (
    <DebugProvider>
      <TraceProvider>
        <AuthProvider>
          <UserProvider>
            <WorkoutProvider>
              {children}
            </WorkoutProvider>
          </UserProvider>
        </AuthProvider>
      </TraceProvider>
    </DebugProvider>
  );
};

/**
 * 🔍 Hook wrapper que automáticamente registra cualquier contexto para debugging
 *
 * USO EN COMPONENTES (opcional, para más granularidad):
 * const workout = useDebuggedContext(useWorkout(), 'WorkoutContext');
 */
export const useDebuggedContext = (contextValue, contextName) => {
  return useContextDebug(contextValue, contextName);
};

export default AppProviders;
