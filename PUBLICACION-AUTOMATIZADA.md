# Publicación automatizada — Pablo Tablet

## El único comando de uso cotidiano

Desde la raíz del repositorio:

```powershell
npm run release
```

Este comando abre un asistente interactivo que recorre el proceso completo. No hay que encadenar órdenes de preparación, validación, PR, fusión, etiqueta y verificación.

Para ensayar exactamente la selección sin crear ramas, Pull Requests, etiquetas, Releases ni APK:

```powershell
npm run release -- --dry-run
```

El `dry-run` actualiza las referencias remotas para poder comparar `dev` y `main`, pero no modifica archivos del proyecto ni publica nada.

## Requisitos

- Node.js 22 o superior y npm.
- Git.
- GitHub CLI (`gh`) autenticado para `Pablo-hg/Pablo-Tablet`.
- JDK 21 y Android SDK para la validación nativa.
- Las funcionalidades deben estar terminadas e integradas en `dev`.

## Qué pregunta y qué hace el asistente

1. Actualiza `origin/main`, `origin/dev` y los tags.
2. Propone la siguiente versión de parche a partir del último tag; se puede escribir otra versión SemVer posterior.
3. Muestra únicamente commits de `dev` cuyo SHA o parche equivalente todavía no está en `main`.
4. Obliga a seleccionar por número los commits exactos. Nunca incorpora `dev` completo.
5. Obliga a escribir los Issues incluidos y comprueba que existen en GitHub.
6. Avisa de posibles dependencias omitidas cuando dos commits pertenecen al mismo Issue o modifican los mismos archivos.
7. Simula en un clon temporal los `cherry-pick` sobre `origin/main`. Un conflicto detiene el proceso antes de crear la rama real.
8. Genera un borrador de novedades sin números de Issue y exige revisarlo o reemplazarlo. Las notas no admiten mensajes técnicos de commit.
9. Enseña el plan final y pide autorización para preparar la rama `release/X.Y.Z` y enviar el PR a `main`.
10. Ejecuta la validación local completa, crea el PR y espera a que termine el workflow obligatorio **Validar pull request**.
11. Solo con el CI aprobado solicita la confirmación exacta e independiente `FUSIONAR vX.Y.Z`. La fusión se hace mediante **merge commit**.
12. Después solicita otra confirmación distinta, `PUBLICAR vX.Y.Z`. Sin ella no crea ni envía el tag.
13. Espera al workflow de publicación y verifica la GitHub Release y sus cuatro artefactos oficiales.

Si se cancela cualquiera de las confirmaciones, el asistente se detiene en ese punto. `FUSIONAR` nunca implica `PUBLICAR`.

## Controles para no introducir otros cambios

- La rama de Release nace siempre del commit actual de `origin/main`.
- Solo se aplican los SHA seleccionados y el archivo de novedades revisado.
- Se rechazan commits de merge, commits ajenos a `origin/dev`, parches ya presentes en `main`, tags repetidos y ramas de Release existentes.
- La selección se vuelve a comprobar después de actualizar las referencias remotas.
- Si `main` avanza antes de abrir el PR, fusionar o publicar, el proceso se bloquea para revisión.
- La simulación de conflictos usa un clon temporal y se elimina al terminar.
- Los cambios locales del checkout desde el que se lanza el asistente se muestran y se conservan; la Release se prepara en un worktree aislado.

Los avisos de dependencia son conservadores: compartir Issue o archivo indica que hay que revisar la relación, no autoriza a añadir el commit omitido. Si falta una dependencia real, hay que cancelar, integrarla primero en `dev` y volver a ejecutar el mismo comando.

## Validación local y CI

Antes de subir la rama se ejecutan:

- `npm ci`
- lint y pruebas web
- compilación web y sincronización de Capacitor
- `git diff --check`
- Android Lint
- pruebas unitarias Android
- APK **debug** de validación

El APK firmado de producción solo lo compila GitHub Actions después del tag autorizado. El workflow `.github/workflows/android-release.yml` sigue siendo la fuente de verdad y el asistente no lo sustituye.

## Verificación de la publicación

La Release solo se considera publicada y verificada cuando contiene:

- `Pablo-Tablet-X.Y.Z.apk`
- `Pablo-Tablet-X.Y.Z.apk.sha256`
- `Pablo-Tablet-X.Y.Z.apk.metadata.txt`
- `Pablo-Tablet-update.json`

El asistente descarga los cuatro archivos y comprueba versión, `versionCode`, paquete, certificado, SHA-256, tamaño, URL, historial de novedades y que el tag apunta al mismo merge commit que `main`.

## Recuperación de errores

- Si una simulación detecta conflictos o dependencias dudosas, no continuar: revisar la selección en `dev` y volver a ejecutar `npm run release`.
- Si falla la validación local, el worktree de la Release se conserva para diagnóstico. No borrar un worktree con cambios sin revisarlo.
- Si falla el CI, no aparece la confirmación de fusión. Corregir la rama y volver a ejecutar las comprobaciones antes de fusionar.
- Si el workflow falla después de publicar el tag, revisar GitHub Actions. No mover, borrar ni reutilizar tags publicados.
- Si falla la verificación de artefactos, no considerar la versión lista para instalar.
- Nunca guardar claves de firma en Git.

## Instalación y cierre

Publicar no instala la aplicación. No usar ADB para actualizar la Teclast.

Pablo inicia en la tablet: **Ajustes → Sistema → Actualizaciones → Buscar actualizaciones**, completa el instalador visible de Android y valida físicamente la versión.

Los estados siguen siendo independientes:

1. Implementado.
2. Integrado en la Release.
3. Publicado y verificado en GitHub.
4. Instalado en la tablet.
5. Validado físicamente.
6. Cerrado.

La automatización nunca cierra Issues ni afirma que la versión está instalada.
