import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const API_TARGET = env.VITE_API_URL || `http://localhost:${env.VITE_API_PORT || 3002}`
  const FRONT_PORT = Number(env.VITE_PORT || 5173)

  // 🔍 DEBUG - Ver qué está pasando
  console.log('🔍 DEBUG - Mode:', mode)
  console.log('🔍 DEBUG - VITE_PORT from env:', env.VITE_PORT)
  console.log('🔍 DEBUG - FRONT_PORT calculated:', FRONT_PORT)
  console.log('🔍 DEBUG - Type of FRONT_PORT:', typeof FRONT_PORT)
  console.log('🔍 DEBUG - All VITE_ env vars:', Object.keys(env).filter(key => key.startsWith('VITE_')))

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: FRONT_PORT,
      strictPort: true,
      proxy: {
        '/api': {
          target: API_TARGET,
          changeOrigin: true,
          secure: false,
        }
      }
    },
    // 🚀 CONFIGURACIÓN DE BUNDLE SPLITTING OPTIMIZADA
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            // ⚡ Vendor libraries en chunks separados
            if (id.includes('node_modules')) {
              // React ecosystem
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
                return 'react-vendor';
              }

              // UI/Animation libraries
              if (id.includes('framer-motion') || id.includes('@radix-ui') || id.includes('lucide-react')) {
                return 'ui-vendor';
              }

              // Charts and visualization
              if (id.includes('recharts') || id.includes('victory')) {
                return 'charts-vendor';
              }

              // Form handling
              if (id.includes('react-hook-form') || id.includes('zod')) {
                return 'forms-vendor';
              }

              // General vendor chunk para el resto
              return 'vendor';
            }

            // 🏋️ Training modules (chunks por funcionalidad)
            if (id.includes('components/HomeTraining/')) {
              return 'home-training';
            }

            if (id.includes('components/routines/')) {
              return 'routines';
            }

            if (id.includes('components/Methodologie/')) {
              return 'methodologies';
            }

            if (id.includes('components/nutrition/')) {
              return 'nutrition';
            }

            if (id.includes('components/profile/')) {
              return 'profile';
            }

            if (id.includes('VideoCorrection')) {
              return 'video-correction';
            }

            // 🎯 Core application chunks
            if (id.includes('components/auth/')) {
              return 'auth';
            }

            if (id.includes('hooks/') || id.includes('contexts/')) {
              return 'core-logic';
            }

            if (id.includes('components/ui/')) {
              return 'ui-components';
            }
          }
        }
      },
      // Optimizaciones adicionales
      target: 'esnext',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true, // Eliminar console.logs en producción
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug']
        }
      },
      // Configuración de chunks
      chunkSizeWarningLimit: 1000, // 1MB límite antes de advertencia
      assetsInlineLimit: 4096 // Inline assets < 4KB
    }
  }
})