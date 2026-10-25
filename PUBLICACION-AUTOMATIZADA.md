# Publicación automatizada — Pablo Tablet

## Objetivo

Preparar, validar y publicar versiones sin depender de IA.

La publicación requiere autorización explícita. Ningún comando
de comprobación o simulación crea versiones de producción.

## Requisitos

- Node.js 22 o superior
- npm
- Git
- GitHub CLI (gh) autenticado
- JDK 21 y Android SDK para las validaciones nativas

## 1. Comprobar el entorno

git fetch origin --prune
npm run release:check -- X.Y.Z

La comprobación es de solo lectura.

## 2. Seleccionar cambios

Revisar los commits de dev y elegir expresamente los que entran.
No incorporar automáticamente todos los cambios de dev.

Preparar un archivo Markdown con las novedades para el usuario.

## 3. Simular la preparación

npm run release:prepare -- X.Y.Z --commits SHA1,SHA2 --issues 12,15 --notes novedades.md --dry-run

La simulación comprueba versión, commits e Issues sin modificar Git.

## 4. Preparar la versión

npm run release:prepare -- X.Y.Z --commits SHA1,SHA2 --issues 12,15 --notes novedades.md

Requiere escribir PREPARAR vX.Y.Z.

Crea un worktree desde origin/main, incorpora los commits
seleccionados, añade las novedades y ejecuta validaciones.

## 5. Validación local

npm run release:validate -- X.Y.Z

Ejecuta npm ci, lint, tests, compilación web, sincronización
Capacitor, Android Lint, tests unitarios Android y APK debug.

No genera un APK firmado de producción.

## 6. Crear el Pull Request

npm run release:submit -- X.Y.Z --issues 12,15

Requiere confirmación ENVIAR vX.Y.Z.

Sube release/X.Y.Z y crea el PR hacia main, con la sección
Incidencias incluidas.

## 7. Fusionar el PR

npm run release:merge -- X.Y.Z --dry-run

Tras revisar el PR y comprobar el CI:

npm run release:merge -- X.Y.Z

Requiere confirmación FUSIONAR vX.Y.Z.

Se utiliza merge commit. No se crea ninguna etiqueta todavía.

## 8. Publicar

npm run release:publish -- X.Y.Z --dry-run

Solo después de autorizar la publicación:

npm run release:publish -- X.Y.Z

Requiere confirmación PUBLICAR vX.Y.Z.

Crea la etiqueta anotada sobre el merge aprobado.
GitHub Actions compila y firma el APK de producción.

## 9. Verificación

npm run release:verify -- X.Y.Z

La Release debe contener:

- Pablo-Tablet-X.Y.Z.apk
- Pablo-Tablet-X.Y.Z.apk.sha256
- Pablo-Tablet-X.Y.Z.apk.metadata.txt
- Pablo-Tablet-update.json

Se comprueban versión, SHA-256, metadatos, manifiesto
y coincidencia entre main y la etiqueta.

## 10. Instalación y validación física

No instalar directamente mediante ADB.

En la tablet:
Ajustes > Sistema > Actualizaciones > Buscar actualizaciones

Completar el instalador visible de Android y validar físicamente.

Estados independientes:
1. Implementado
2. Integrado en la Release
3. Publicado
4. Instalado en la tablet
5. Validado físicamente
6. Cerrado

La publicación nunca cierra automáticamente los Issues.

## Recuperación de errores

Si falla una validación, no continuar hasta corregirla.

Si hay conflictos de cherry-pick, resolverlos en el worktree,
ejecutar git cherry-pick --continue y repetir la validación.

Si el workflow de publicación falla después de enviar la
etiqueta, revisar GitHub Actions. No mover ni reutilizar tags.

Si falla la verificación de los archivos publicados, no
considerar la versión instalada ni validada.

Nunca limpiar worktrees con cambios sin revisarlos previamente.
Nunca introducir claves de firma en Git.

## Seguridad

- Sin selección automática de commits.
- Sin publicación implícita.
- Confirmaciones obligatorias para operaciones críticas.
- Los tags publicados son inmutables.
- La instalación y validación física son manuales.
