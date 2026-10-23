# Publicar una nueva versión de Pablo Tablet

Esta guía resume el proceso de preparación y publicación. No se debe crear una versión, etiqueta o APK de producción hasta que Pablo lo autorice expresamente.

## 1. Preparar una rama limpia

1. Actualizar las referencias remotas y confirmar cuál es la última versión publicada.
2. Crear un worktree limpio desde `origin/main`.
3. Crear una rama `release/X.Y.Z`.
4. Incorporar únicamente los commits que deben formar parte de la versión.
5. Resolver conflictos conservando tanto los cambios funcionales como las traducciones existentes.

## 2. Preparar las novedades

Crear `.github/release-notes/vX.Y.Z.md` con textos claros para el usuario, sin números ni títulos técnicos de Issues.

El manifiesto de actualización reúne automáticamente los archivos de `.github/release-notes/` comprendidos entre la versión instalada y la nueva. Así, si se omiten versiones intermedias, la tablet muestra todas sus novedades en orden.

## 3. Validar localmente

Ejecutar desde la raíz del proyecto:

```powershell
npm ci
npm run lint
npm test -- --run
npm run android:sync
git diff --check
```

Después, desde `android/`:

```powershell
.\gradlew.bat lintDebug testDebugUnitTest assembleDebug
```

Si el worktree no tiene `android/local.properties`, crear ese archivo local con la ruta del Android SDK. No debe añadirse a Git.

## 4. Publicar el cambio en GitHub

1. Confirmar que el worktree está limpio.
2. Subir `release/X.Y.Z`.
3. Abrir un PR hacia `main`.
4. Incluir en el cuerpo del PR una sección `## Incidencias incluidas` con todos los Issues publicados.
5. Esperar a que `Validar pull request` termine correctamente.
6. Fusionar el PR mediante merge commit.

## 5. Crear la versión

1. Actualizar `main` y comprobar el SHA del merge.
2. Crear la etiqueta anotada `vX.Y.Z` exactamente sobre ese merge.
3. Subir la etiqueta.
4. Esperar a que `Publicar actualización Android` termine correctamente.

La automatización compila y firma el APK, comprueba paquete, versión, código y certificado, genera SHA-256 y manifiesto, y publica la GitHub Release con sus archivos.

## 6. Verificación final

Comprobar que la Release contiene:

- `Pablo-Tablet-X.Y.Z.apk`
- `Pablo-Tablet-X.Y.Z.apk.sha256`
- `Pablo-Tablet-X.Y.Z.apk.metadata.txt`
- `Pablo-Tablet-update.json`

Confirmar también que `main` y `vX.Y.Z` apuntan al mismo commit y que el manifiesto anuncia la versión correcta.

## 7. Instalación y cierre

No instalar directamente mediante ADB. Pablo inicia `Buscar actualizaciones` en la tablet y completa el instalador visible de Android.

Estados que deben distinguirse:

1. Implementado.
2. Integrado en la Release.
3. Publicado.
4. Instalado en la tablet.
5. Validado físicamente.
6. Cerrado.

Una publicación correcta no confirma por sí sola la instalación ni la validación física.
