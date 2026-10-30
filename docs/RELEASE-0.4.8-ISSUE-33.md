# Preparación de release 0.4.8 — solo Issue #33

Fecha: 30/10/2026. Estado: preparación local para revisión; publicación no autorizada.

## Base y aislamiento

- Repositorio: `Pablo-hg/Pablo-Tablet`.
- Base exacta: `origin/main` / `a848560d3a70df497109f8e34534d28f2be12711`.
- PR fuente: [#76](https://github.com/Pablo-hg/Pablo-Tablet/pull/76), fusionado en `dev` mediante `5c7d828fee5447add7ec84c6e8d0f89abb2aee79`.
- Rama preparada: `release/0.4.8`.
- Worktree: `C:\Users\Pablo\Desktop\Pablo-Tablet-automatizacion\.worktrees\release-0.4.8`.
- Código validado: `f545b54401114b9f0d5fa87ab3461f30cfc12c4a`; los commits posteriores de esta preparación son documentación.
- El checkout canónico sigue en `fix/33-validacion-mvp`, sin cambiar archivos ni su HEAD. `dev` y `main` no se han modificado. El automatizador local tampoco se ha editado.
- `0.4.8` es la siguiente versión propuesta después de la última publicación `v0.4.7`. No se cambian `versionName`, `versionCode` ni `package.json`: el workflow obtiene la identidad de producción del futuro tag y de su ejecución cuando se autorice publicar.

## Los ocho commits seleccionados

Cada commit portado conserva el trailer `cherry picked from commit` con el SHA completo de origen. No se ha fusionado `dev` ni se ha seleccionado un commit completo de #30.

| Origen del PR #76 | Commit en release | Contenido y dependencia |
| --- | --- | --- |
| `8f781d1` | `df7e479` | Viewport del teclado de Notas y `adjustResize`; se aplica sobre el editor existente en main. |
| `33c56f5` | `6ed9c01` | Color y entrada del texto activo; estilos de navegación ya existentes. |
| `a913d9d` | `db97338` | Notas en retrato y menú +; comparte el contexto de estilos del primer arreglo. |
| `1db33a4` | `c2642c6` | Predicado de sonido para botones y selectores. |
| `a8a9a2f` | `e0f2ffe` | Conservación de trazos/puntos al leer y guardar; sin cambiar formato ni esquema de almacenamiento. |
| `95752ee` | `5c18400` | Recuperación inicial y bloqueo de edición; requiere portar el contrato de disponibilidad descrito abajo. |
| `63fb890` | `27b6978` | Ventana futura de recordatorios y reposición horaria; reutiliza recurrencias ya existentes y el contrato de disponibilidad. |
| `401efd4` | `e3b538c` | Corrige el objetivo tipado del test introducido por `1db33a4`. |

Adicionalmente, `f545b54` completa las protecciones de arranque de esta integración y prueba la conservación de notas y configuración al reiniciar. No introduce módulos nuevos.

## Conflictos y dependencia mínima con #30

La simulación original falla en `95752ee3be84` porque su padre en dev contiene código que main no tiene: `useDashboardPersistence` devolvía `ready`, `App` lo consumía y `useDeviceEffects` aceptaba ese tercer argumento. El cherry-pick por sí solo dejaba además referencias a `ready` y `dashboardReady` sin su declaración, aunque Git no marcara conflictos en esos archivos.

Se resolvió expresamente:

1. `src/hooks/useDashboardPersistence.ts`: recuperar el contrato reactivo de disponibilidad y el bucle de lectura sin solapamientos; conservar los métodos y claves de almacenamiento de main. No marcar disponible una lectura fallida y reintentar, también con una base inicialmente vacía.
2. `src/App.tsx`: consumir la disponibilidad y esperar antes de mostrar la interfaz editable, procesar vencimientos o acciones de notificación.
3. `src/hooks/useDeviceEffects.ts`: no aplicar ajustes ni reconciliar avisos con datos iniciales vacíos; ejecutar al terminar la recuperación con los datos restaurados.
4. `src/test/notificationStartup.test.tsx`: incorporar solo el fixture de arranque necesario para acreditar lo anterior y para aplicar el siguiente commit de #33.
5. `63fb890`: conflicto en los imports de `src/test/reminderNotifications.test.ts`; conservar los imports de main y añadir `afterEach`, sin importar las pruebas y funciones de tonos/temporizadores de #30.

Esta dependencia es imprescindible para la corrección de persistencia de #33. No depende de los cambios de sonido nativo, selección de tonos, presentación de widgets o meteorología de #30.

## Protección de datos Android

- La lectura inicial de SQLite se trata como autoritativa; no se guarda el estado provisional de la interfaz sobre ella.
- La interfaz permanece sin edición hasta finalizar la recuperación. Un fallo de lectura no habilita escrituras ni sincronizaciones de notificaciones con arrays vacíos.
- Se evita el solapamiento entre la lectura inicial y el sondeo móvil.
- Las escrituras y relecturas conservan notas y preferencias; se prueba editar, desmontar, montar de nuevo y recuperar ambos conjuntos de datos.
- Los efectos del idioma y de la limpieza de galería también esperan al estado nativo. Esto evita cambiar prematuramente el idioma guardado o borrar una foto que un respaldo antiguo todavía marcaba como caducada, aunque SQLite ya la hubiera restaurado.
- Se comprueba que una lectura pendiente completada después del desmontaje no escribe una base vacía.
- No cambian `PabloTabletDatabase.java`, `AppStoragePlugin.java`, la versión del esquema, las claves SQLite/localStorage, los archivos originales de fotos ni el mecanismo de actualización de main.
- No se han abierto ni modificado datos de la Teclast. Las pruebas de puente usan datos sintéticos y la suite JVM prueba migraciones en bases de prueba.

## Exclusiones comprobadas

La comprobación automática registrada en `release-0.4.8-issue-33.json` verifica que los 18 archivos de código cambiados están dentro del conjunto de archivos del PR #76. También comprueba 19 rutas que deben permanecer idénticas a main.

Permanecen iguales a main:

- `package.json` y `package-lock.json`; no se ejecuta el postinstall/parche de #30.
- Todo `android/app/src/main/java`, incluidos `AlarmSoundsPlugin`, almacenamiento, administración móvil y actualizador.
- El parche `scripts/patch-local-notifications.mjs` y el test `RecurringNotificationTest` de #30 siguen ausentes.
- Tonos de temporizador, `src/alarmSounds.ts` y cambios del ejecutor del asistente.
- Nuevos widgets de Notas/Reloj, sus estilos y sus pruebas.
- Nuevo diseño y estilos de Tiempo, caché día/noche y `src/weather.ts`.
- Workflows, Gradle y configuración de versiones.

La única modificación del manifiesto Android es `windowSoftInputMode="adjustResize"`, perteneciente al primer commit de #33. Los imports y el comportamiento de alarmas/temporizadores de `reminderNotifications.ts` conservan main; únicamente cambia la ventana de calendario de #33.

## Validación realizada en esta release aislada

| Comprobación | Resultado |
| --- | --- |
| `npm ci` | Correcto, dependencias de main. Seis alertas heredadas del inventario de dependencias; no se modifican dependencias en esta selección. |
| `npm run lint` | Correcto. |
| `npm test` | 170/170 en 31 archivos. |
| `npm run build` | Correcto, TypeScript incluido; aviso conocido de bundle >500 kB. |
| `npx cap sync android` | Correcto. |
| `gradlew.bat -p android lintDebug testDebugUnitTest assembleDebug` | Correcto; 38/38 pruebas JVM, cero fallos/errores, APK debug local ensamblado. |
| Android Lint de la app | 0 errores, 29 avisos. Los filtros/baselines de dependencias permanecen como en main. |
| Comparación de selección y exclusiones | Correcta; ocho commits del PR y adaptación mínima documentada. |
| `git diff --check` | Correcto. Los dos archivos generados por Capacitor solo cambiaban finales de línea y se restauraron en este worktree. |

Los registros locales se conservan en `output/playwright/release-33/` y los informes Android en `android/app/build/reports/`. El número de pruebas difiere de dev porque las suites de #30 no forman parte de esta release. El APK ensamblado es debug de comprobación; no es una release firmada ni se ha instalado o publicado.

## Automatizador: por qué no puede continuar directamente

`publicar.ps1` solo traduce `-DryRun` y `-RutaProyecto` a la CLI. `src/cli.mjs` no reconoce opciones de reanudación: únicamente `--dry-run`, `--repo-path` y ayuda.

La CLI vuelve a llamar a `simulateCommits` con los SHAs originales sobre `origin/main`. Esta simulación siempre crea un clon temporal nuevo y lo elimina al finalizar; no conserva un punto donde resolver y continuar. Cambiar `-RutaProyecto` a este worktree no evita esa simulación.

Además, `prepareRelease` rechaza una rama o un worktree ya existentes. Por tanto, volver a ejecutar el flujo actual no reutiliza esta preparación: volverá a fallar en la simulación o a rechazar `release/0.4.8`.

No se ha cambiado el automatizador ni se han desactivado sus controles. Las funciones exportadas `validateProject` y `submitRelease` pueden operar sobre un worktree existente si se invocan expresamente, pero eso no constituye una reanudación soportada por `publicar.ps1`. `submitRelease` hace push y crea PR; no se debe confundir su uso con una validación de solo lectura.

Para integrar una continuación segura en su uso normal necesita una opción de tipo `--resume --version 0.4.8` o `--prepared-worktree <ruta>`, con estas verificaciones:

1. Repositorio, base main exacta, versión, rama y worktree coinciden con el punto de revisión registrado.
2. Árbol limpio, ocho SHAs de origen trazados y resolución adicional documentada; no basta con omitir la simulación globalmente.
3. Repetir validaciones y revisar diferencias si `origin/main` ha avanzado.
4. Reutilizar/crear el PR de esta rama en lugar de recrearla o volver a aplicar los ocho commits.
5. Mantener separadas las autorizaciones de merge y publicación. Un conflicto resuelto no autoriza tags, releases ni instalación.

El JSON de selección de este documento sirve como evidencia para esa futura opción; la CLI actual no lo lee. No debe editarse el inventario para fingir que los commits ya están en main ni añadir #30 a la selección solo para evitar el conflicto.

## Revisión y límites

- Revisar el diff `origin/main...release/0.4.8` y el borrador de novedades en `.github/release-notes/v0.4.8.md`.
- Antes de crear un PR, confirmar que main sigue en la base indicada y volver a validar cualquier cambio funcional posterior.
- El cuerpo propuesto de PR está preparado en `docs/release-0.4.8-pr.md`; enumera únicamente `Refs #33`.
- Esta preparación no añade las correcciones nativas pendientes de #30. En particular, los cambios de entrega/sonido y repetición Android de esa tarea permanecen fuera.
- Los resultados automáticos no acreditan una actualización firmada conservando datos reales ni la entrega de avisos en Android 16. Sigue pendiente la validación física autorizada.
- Los otros hallazgos de la auditoría que no resolvió el PR #76, como reducir movimiento y restaurar la distribución al cerrar el teclado manteniendo foco, no se corrigen dentro de esta preparación de integración. Deben tenerse presentes al decidir qué validar/publicar.
- No se ha hecho push de esta rama, creado PR, fusionado main, creado tags, firmado/publicado APK, creado GitHub Release ni instalado nada.
