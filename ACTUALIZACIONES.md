# Actualizaciones remotas

> Documento relacionado: [OPERACION-REMOTA.md](OPERACION-REMOTA.md)

El repositorio `Pablo-hg/Pablo-Tablet` es público para que cada instalación pueda descargarlo, revisarlo y adaptarlo. La aplicación no actualiza desde el código fuente: consulta la última Release publicada en este mismo repositorio, que contiene el APK firmado y su SHA-256. La versión preparada es `0.2.0`. El número solo debe cambiar cuando Pablo lo indique expresamente, y una actualización únicamente se ofrece cuando el tag de la Release es superior a la versión instalada.

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
5. Instalar una primera compilación firmada con esa clave mientras la tablet siga accesible localmente. Una instalación debug existente no se puede actualizar con una firma release diferente; antes de sustituirla hay que proteger o exportar los datos que deban conservarse.
6. En Android, permitir una vez que Pablo Tablet instale aplicaciones desde esta fuente cuando el actualizador abra ese ajuste.

## Publicar una versión

Después de integrar y validar los cambios, crear el tag que Pablo haya aprobado expresamente y enviarlo a GitHub. Para publicar la versión `0.2.0`:

```powershell
git tag v0.2.0
git push origin v0.2.0
```

El workflow `.github/workflows/android-release.yml` ejecuta lint, tests y build, compila un APK firmado y crea la Release con su APK y SHA-256. La tablet podrá encontrarla desde `Ajustes > Sistema > Actualizaciones`.

Fusionar una rama en `dev` o terminar sus pruebas no publica por sí solo una actualización. Los cambios aprobados se trasladan de forma selectiva a una rama `release/<version>` creada desde `main`, se validan de nuevo y llegan a `main` mediante PR. GitHub Actions solo acepta `release/*` o `hotfix/*` como origen de un PR hacia `main`. La publicación empieza únicamente al crear un tag `vX.Y.Z` sobre el commit fusionado. Después de una Release correcta, el workflow localiza ese PR y marca como `implementado` los Issues enumerados en él.

No incrementar, reutilizar ni cambiar un número de versión sin indicación expresa de Pablo. Tampoco publicar manualmente APK firmados con otra clave.
