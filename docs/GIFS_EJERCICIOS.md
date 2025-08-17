# GIFs de Ejercicios

- Ubicación de archivos: `public/gifs/`
- Cómo se resuelven:
  1. Si en el plan IA un ejercicio trae `gif_url`, se usa esa URL directamente.
  2. Si no, se busca un path local en `src/config/exerciseGifs.js` por nombre normalizado del ejercicio.

## Añadir nuevos GIFs
- Copia tu `*.gif` a `public/gifs/`.
- Abre `src/config/exerciseGifs.js` y añade una entrada en `GIFS_MAP`:

```js
'plancha lateral': '/gifs/plancha_lateral.gif',
```

## Consejos
- Mantén los nombres en minúsculas y sin acentos.
- Optimiza el tamaño de los GIFs para mejorar rendimiento.
- Puedes cambiar a MP4/WebM si prefieres, manteniendo el mismo campo `gif_url`.

