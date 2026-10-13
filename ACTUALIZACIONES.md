# Actualizaciones remotas

> Documento relacionado: [OPERACION-REMOTA.md](OPERACION-REMOTA.md)

El repositorio `Pablo-hg/Pablo-Tablet` es público para que cada instalación pueda descargarlo, revisarlo y adaptarlo. La aplicación no actualiza desde el código fuente: consulta la última Release publicada en este mismo repositorio, que contiene el APK firmado y su SHA-256. La última versión publicada e instalada es `0.2.1` (`versionCode 1002`). El número siguiente solo debe elegirse cuando Pablo lo indique expresamente, y una actualización únicamente se ofrece cuando el tag de la Release es superior a la versión instalada.

## Seguridad

- La aplicación solo acepta APK alojados en las Releases oficiales del repositorio.
- Antes de abrir el instalador compara el SHA-256 descargado con el digest publicado por GitHub.
- Android comprueba además que el APK conserva el identificador `com.pablohorcajada.tablet`, que aumenta su `versionCode` y que está firmado con la misma clave que la versión instalada.
- La clave de firma no se guarda en el repositorio.

## Estado de la firma oficial

Los APK publicados como `v0.2.0` y `v0.2.1` se han verificado con `apksigner`: ambos tienen una firma válida y comparten la huella SHA-256 de certificado `7a706549c89f27d3560fad8ffb7127d395c3830d18f403463d65d9e2fb6af346`. Sus archivos `.sha256` publicados también coinciden con los APK.

Los cuatro secrets necesarios (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` y `ANDROID_KEY_PASSWORD`) están configurados en GitHub. Sus valores no se consultan ni se guardan en el repositorio. Queda pendiente confirmar fuera del repositorio el responsable y las ubicaciones de las copias privadas de la clave y sus credenciales.

## Preparación y recuperación

Estos pasos describen la creación inicial o la recuperación si se pierde la configuración de GitHub. No deben generar una clave nueva mientras exista la oficial: una clave distinta impediría actualizar las instalaciones actuales.

1. Si todavía no existiera una clave oficial, crearla y respaldarla:

   ```powershell
   keytool -genkeypair -v -keystore pablo-tablet-release.jks -alias pablo-tablet -keyalg RSA -keysize 4096 -validity 10000
   ```

2. Guardar el archivo y sus contraseñas en al menos dos ubicaciones privadas. Si se pierde esta clave no se podrán instalar nuevas versiones sobre la aplicación existente.
3. En `Pablo-hg/Pablo-Tablet`, crear estos Actions secrets aunque el repositorio sea público:

   - `ANDROID_KEYSTORE_BASE64`: contenido Base64 del archivo `.jks`.
   - `ANDROID_KEYSTORE_PASSWORD`: contraseña del almacén.
   - `ANDROID_KEY_ALIAS`: `pablo-tablet` si se utiliza el comando anterior.
   - `ANDROID_KEY_PASSWORD`: contraseña de la clave.

   En PowerShell se puede obtener el Base64 con:

   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes('pablo-tablet-release.jks'))
   ```

4. En **Settings → Actions → General → Workflow permissions**, permitir que `GITHUB_TOKEN` escriba el contenido necesario para crear Releases en el propio repositorio. No se necesita un token personal para publicar el APK.
5. Instalar una primera compilación firmada con esa clave mientras la tablet siga accesible localmente. Este paso ya se completó con `v0.2.1`; cualquier recuperación futura debe conservar el mismo certificado. Una instalación debug existente no se puede actualizar con una firma release diferente; antes de sustituirla hay que proteger o exportar los datos que deban conservarse.
6. En Android, permitir una vez que Pablo Tablet instale aplicaciones desde esta fuente cuando el actualizador abra ese ajuste.

## Publicar una versión

Después de integrar y validar los cambios, crear el tag que Pablo haya aprobado expresamente y enviarlo a GitHub. Por ejemplo, sustituyendo `X.Y.Z` por el número aprobado:

```powershell
git tag vX.Y.Z
git push origin vX.Y.Z
```

El workflow `.github/workflows/android-release.yml` ejecuta lint, tests y build, valida el almacén y el alias de firma, compila el APK y verifica con las herramientas oficiales de Android:

- que la firma criptográfica del APK es válida;
- que la huella del certificado coincide con la firma oficial instalada;
- que el paquete es `com.pablohorcajada.tablet`;
- que `versionName` coincide con el tag;
- que el `versionCode` es superior al `1002` instalado;
- que el SHA-256 publicado coincide con el APK.

La Release incluye el APK, su `.sha256` y un `.metadata.txt` con paquete, versión, huella pública del certificado y digest del artefacto. La clave temporal se elimina del runner incluso si falla un paso. La tablet podrá encontrar la versión desde `Ajustes > Sistema > Actualizaciones`.

Fusionar una rama en `dev` o terminar sus pruebas no publica por sí solo una actualización. Los cambios aprobados se trasladan de forma selectiva a una rama `release/<version>` creada desde `main`, se validan de nuevo y llegan a `main` mediante PR. GitHub Actions solo acepta `release/*` o `hotfix/*` como origen de un PR hacia `main`. La publicación empieza únicamente al crear un tag `vX.Y.Z` sobre el commit fusionado. Después de una Release correcta, el workflow localiza ese PR y deja como `implementado` cada Issue enumerado que aún no esté `instalado`. La etiqueta `instalado` solo se aplica después de una comprobación física.

No incrementar, reutilizar ni cambiar un número de versión sin indicación expresa de Pablo. Tampoco publicar manualmente APK firmados con otra clave.
