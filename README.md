# Oficina IA

Versión personalizada de [Munder Difflin](https://github.com/HarnessMD/munder-difflin) (MIT).
Este repo solo guarda **nuestros cambios**; el código base se baja de Munder en cada compilación.

## Cómo funciona
- Todos los días GitHub revisa si Munder publicó código nuevo.
- Si hay algo nuevo (o si cambias algo en `custom/`), compila el instalador de Windows con nuestros cambios
  y lo publica en **Releases**.
- La app instalada se actualiza sola desde los Releases de este repo.

## Dónde van los cambios
- `custom/apply.cjs` — cambios por código (nombre, versión, de dónde se actualiza…).
- `custom/overrides/` — archivos que reemplazan a los originales (íconos, imágenes, archivos completos),
  con la misma ruta que tienen en el repo de Munder.
- `custom/patches/` — parches `.patch` para cambios más grandes.
- `custom/release-notes.md` — lo que muestra el aviso de actualización.

## Compilar a mano
Pestaña **Actions** → **Build Oficina IA** → **Run workflow**.

## Créditos
Munder Difflin © Chaitanya Giri, licencia MIT. Gráficos de LimeZu (Modern Interiors), con atribución.
