## Resumen

Prepara 0.4.8 desde `main` con los ocho commits del PR #76. Resuelve sus dependencias mínimas de recuperación del almacenamiento Android sin incluir las demás funciones de `dev`.

La adaptación espera a los datos nativos antes de permitir edición, aplicar ajustes/idioma, reconciliar notificaciones o purgar fotos del respaldo anterior. Incluye regresiones de conservación de notas y preferencias tras reiniciar.

## Incidencias incluidas

- Refs #33

## Selección y dependencias

- Los ocho commits originales conservan trazabilidad mediante trailers de cherry-pick.
- Dependencia imprescindible de #30: únicamente disponibilidad del estado nativo y comprobaciones de arranque. No se incluye ningún commit completo de esa tarea.
- Quedan fuera tonos, parches nativos de notificaciones, nuevos widgets y meteorología de #30.
- Análisis, mapa de commits, exclusiones y límites: `docs/RELEASE-0.4.8-ISSUE-33.md` y `docs/release-0.4.8-issue-33.json`.

## Validación

- [x] `npm ci`, lint y build oficial con TypeScript.
- [x] 170 pruebas web.
- [x] Sincronización Capacitor.
- [x] Android Lint, 38 pruebas JVM y `assembleDebug`.
- [x] Comparación de selección frente a main y revisión de exclusiones.
- [ ] Actualización firmada y conservación de datos en la Teclast T65.
- [ ] Recorridos físicos de teclado, sonido y notificaciones en Android 16.

## Pendiente

Revisar alcance, novedades y limitaciones funcionales documentadas. El automatizador actual no reanuda este worktree; necesita una opción de continuación o seguir los pasos de revisión expresamente.

Esta preparación no autoriza fusionar en main, crear tags ni publicar APK o GitHub Release.
