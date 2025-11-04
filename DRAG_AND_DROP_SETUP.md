# 🚀 Setup Rápido: Sistema Drag & Drop

## ✅ Pasos para activar el sistema

### 1️⃣ Migración de Base de Datos

**Ejecutar en Supabase SQL Editor:**

```bash
psql $DATABASE_URL -f backend/migrations/create_user_layouts_table.sql
```

O copiar y pegar en SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS app.user_layouts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  layout_id VARCHAR(100) NOT NULL,
  layout_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, layout_id)
);

CREATE INDEX idx_user_layouts_user_id ON app.user_layouts(user_id);
CREATE INDEX idx_user_layouts_layout_id ON app.user_layouts(layout_id);
```

### 2️⃣ Iniciar Servidores

```bash
# Terminal 1: Frontend
npm run dev

# Terminal 2: Backend
npm run dev:backend
```

### 3️⃣ Probar el Sistema

1. Iniciar sesión en la app
2. Ir a **Rutinas** → Iniciar un entrenamiento
3. Dentro del modal de ejercicio, buscar el botón **⚙️ Personalizar** (esquina superior derecha)
4. Click en **Personalizar** → Arrastra los botones
5. Click en **Guardar Orden**

**Los cambios se guardan automáticamente en:**

- ✅ `localStorage` (inmediato)
- ✅ Base de datos (sincronización en 1 segundo)

---

## 🎯 Dónde está implementado

### ✅ Ya Funcional

**Archivo**: `src/components/routines/session/ExerciseSessionView.jsx`

- Botones de control de ejercicio (Play, Pausar, Saltar, etc.)
- Toggle de personalización incluido
- Persistencia automática funcionando

---

## 📚 Documentación Completa

Ver: [`docs/DRAG_AND_DROP_SYSTEM.md`](docs/DRAG_AND_DROP_SYSTEM.md)

Incluye:

- Uso en otros componentes
- Ejemplos de código
- API Reference completa
- Troubleshooting

---

## 🔧 Archivos Creados

### Frontend

```
src/components/customization/
├── DraggableWrapper.jsx          # Wrapper universal para elementos draggables
├── CustomizableContainer.jsx     # Contenedor con lógica drag-and-drop
└── index.js                      # Exports limpios

src/hooks/layout/
└── useCustomLayout.js            # Hook para persistencia + toggle edición
```

### Backend

```
backend/routes/
└── userPreferences.js            # API para guardar/cargar layouts

backend/migrations/
└── create_user_layouts_table.sql # Migración SQL
```

### Docs

```
docs/
└── DRAG_AND_DROP_SYSTEM.md       # Documentación completa

DRAG_AND_DROP_SETUP.md            # Este archivo (setup rápido)
```

---

## 🎨 Usar en Otros Componentes

### Código Mínimo

```jsx
import {
  DraggableWrapper,
  CustomizableContainer,
  useCustomLayout,
  useEditMode
} from '@/components/customization';

function MiComponente() {
  const [editMode, toggleEditMode] = useEditMode();
  const [layout, saveLayout] = useCustomLayout('mi-layout-id', [
    'item-1',
    'item-2',
    'item-3'
  ]);

  return (
    <>
      <button onClick={toggleEditMode}>Personalizar</button>

      <CustomizableContainer
        items={layout}
        onReorder={saveLayout}
        editMode={editMode}
        strategy="vertical"
      >
        {layout.map(id => (
          <DraggableWrapper key={id} id={id} editMode={editMode}>
            <div>Elemento {id}</div>
          </DraggableWrapper>
        ))}
      </CustomizableContainer>
    </>
  );
}
```

---

## ✅ Checklist Post-Setup

- [ ] Migración SQL ejecutada
- [ ] Backend corriendo (`npm run dev:backend`)
- [ ] Frontend corriendo (`npm run dev`)
- [ ] Probado en modal de ejercicio
- [ ] Orden guardado y persistente al recargar

---

## 🐛 Problemas Comunes

### "Cannot find module customization"

**Solución**: Reiniciar el servidor de Vite

```bash
# Ctrl+C para detener
npm run dev
```

### "Tabla user_layouts no existe"

**Solución**: Ejecutar la migración SQL

```bash
psql $DATABASE_URL -f backend/migrations/create_user_layouts_table.sql
```

### Los cambios no persisten

**Solución**: Verificar que el backend está corriendo y que estás autenticado

```javascript
// En la consola del navegador
console.log(localStorage.getItem('authToken'));
```

---

## 🎯 Próximos Componentes a Implementar

1. **Modal de Propuesta de Ejercicios** (reordenar ejercicios)
2. **Dashboard de Nutrición** (reordenar comidas y macros)
3. **Perfil de Usuario** (widgets de estadísticas)

Todos usan el **mismo código base** con diferentes IDs de layout.

---

**¡Sistema listo para usar!** 🚀

Para más ejemplos, ver: `docs/DRAG_AND_DROP_SYSTEM.md`
