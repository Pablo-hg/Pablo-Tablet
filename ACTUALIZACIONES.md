# Actualizaciones remotas

> Documento relacionado: [OPERACION-REMOTA.md](OPERACION-REMOTA.md)

El repositorio de código `Pablo-hg/Pablo-Tablet` es público para que cada instalación pueda descargarlo, revisarlo y adaptarlo. La aplicación no actualiza desde el código fuente: consulta la última Release de un repositorio público separado, `Pablo-hg/Pablo-Tablet-Releases`, que contiene únicamente los APK firmados. La versión actual es `0.1.0`. El número solo debe cambiar cuando Pablo lo indique expresamente, y una actualización únicamente se ofrece cuando el tag de la Release es superior a la versión instalada.

## Seguridad

- La aplicación solo acepta APK alojados en las Releases oficiales del repositorio.
- Antes de abrir el instalador compara el SHA-256 descargado con el digest publicado por GitHub.
- Android comprueba además que el APK conserva el identificador `com.pablohorcajada.tablet`, que aumenta su `versionCode` y que está firmado con la misma clave que la versión instalada.
- La clave de firma no se guarda en el repositorio.

## Preparación única

1. Crear y respaldar una clave de firma definitiva:

   ```powershell
   keytool -genkeypair -v -keystore pablo-tablet-release.jks -alias pablo-tablet -keyalg RSA -keysize 4096 -validity 10000
   ```

2. Guardar el archivo y sus contraseñas en al menos dos ubicaciones privadas. Si se pierde esta clave no se podrán instalar nuevas versiones sobre la aplicación existente.
3. Crear el repositorio público `Pablo-hg/Pablo-Tablet-Releases` con una rama `main`. No copiar allí el código fuente.
4. En `Pablo-hg/Pablo-Tablet`, crear estos Actions secrets aunque el repositorio sea público:

   - `ANDROID_KEYSTORE_BASE64`: contenido Base64 del archivo `.jks`.
   - `ANDROID_KEYSTORE_PASSWORD`: contraseña del almacén.
   - `ANDROID_KEY_ALIAS`: `pablo-tablet` si se utiliza el comando anterior.
   - `ANDROID_KEY_PASSWORD`: contraseña de la clave.
   - `UPDATE_REPO_TOKEN`: token fine-grained con permiso `Contents: Read and write` limitado exclusivamente a `Pablo-Tablet-Releases`.

   En PowerShell se puede obtener el Base64 con:

   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes('pablo-tablet-release.jks'))
   ```

5. Instalar una primera compilación firmada con esa clave mientras la tablet siga accesible localmente. Una instalación debug existente no se puede actualizar con una firma release diferente; antes de sustituirla hay que proteger o exportar los datos que deban conservarse.
6. En Android, permitir una vez que Pablo Tablet instale aplicaciones desde esta fuente cuando el actualizador abra ese ajuste.

## Publicar una versión

Después de integrar y validar los cambios, crear el tag que Pablo haya aprobado expresamente y enviarlo a GitHub. Para publicar la versión actual `0.1.0` como primera base firmada:

```powershell
git tag v0.1.0
git push origin v0.1.0
```

El workflow `.github/workflows/android-release.yml` ejecuta lint, tests y build, compila un APK firmado y crea la Release con su APK y SHA-256. La tablet podrá encontrarla desde `Ajustes > Sistema > Actualizaciones`.

Fusionar una rama en `dev` o terminar sus pruebas no publica por sí solo una actualización. Los cambios aprobados se trasladan de forma selectiva a una rama `release/<version>` creada desde `main`, se validan de nuevo y llegan a `main` mediante PR. La publicación empieza únicamente al crear un tag `vX.Y.Z` sobre el commit fusionado. Después de una Release correcta, el workflow marca como `implementado` los Issues enumerados en el PR de publicación.

La documentación ya adopta este recorrido selectivo, pero los workflows todavía deben aceptar `release/*` hacia `main` y reconocer ese PR durante la publicación antes de crear el primer tag.

No incrementar, reutilizar ni cambiar un número de versión sin indicación expresa de Pablo. Tampoco publicar manualmente APK firmados con otra clave.
