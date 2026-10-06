# Flujo de ramas, versiones y tickets

Este documento define el proceso de trabajo de Pablo Tablet. Su objetivo es mantener `main` siempre estable y distribuible, probar conjuntamente los cambios antes de publicarlos y conservar la relación entre GitHub Issues, ramas, pull requests, versiones y APK.

La versión de producto preparada para publicación es `0.2.0`. Integrar código no cambia por sí solo ese número: la nueva versión estará disponible cuando se cree el tag aprobado y el workflow publique correctamente su Release.

## Ramas permanentes

| Rama   | Función                                          | Qué puede entrar                                                  |
| ------ | ------------------------------------------------ | ----------------------------------------------------------------- |
| `main` | Estado estable y publicado del producto          | Pull requests desde `release/*` y hotfixes excepcionales          |
| `dev`  | Integración y validación de la siguiente versión | Pull requests procedentes de `feature/*` y `fix/*`                |

No se desarrolla directamente sobre `main` ni sobre `dev`.

## Ramas temporales

- `feature/<issue>-<descripcion>`: funcionalidad nueva. Parte de `dev`.
- `fix/<issue>-<descripcion>`: corrección normal. Parte de `dev`.
- `release/<version>`: selección de cambios ya probados que se publicará. Parte de `main`.
- `hotfix/<issue>-<descripcion>`: corrección urgente de una versión ya publicada. Parte de `main` y, después de publicarse, también se incorpora a `dev`.

### Nomenclatura exacta

| Tipo | Formato obligatorio | Rama base | Ejemplo válido |
| --- | --- | --- | --- |
| Funcionalidad | `feature/<numero-issue>-<descripcion>` | `dev` | `feature/12-copias-seguridad` |
| Corrección normal | `fix/<numero-issue>-<descripcion>` | `dev` | `fix/18-reconexion-movil` |
| Publicación | `release/<major>.<minor>.<patch>` | `main` | `release/0.1.1` |
| Corrección urgente | `hotfix/<numero-issue>-<descripcion>` | `main` | `hotfix/24-arranque-tablet` |
| Automatización interna | `automation/<descripcion>` | la que determine el workflow | `automation/feedback-24` |

Reglas obligatorias:

- utilizar siempre minúsculas;
- crear primero el Issue si el trabajo manual todavía no tiene uno; no se inventa el número, no se usa `0` y no se omite;
- escribir el número decimal del Issue sin `#` en `feature/*`, `fix/*` y `hotfix/*`;
- utilizar una descripción corta en español, sin tildes ni `ñ` y separada con guiones;
- no utilizar espacios, guiones bajos, mayúsculas ni caracteres especiales;
- utilizar entre dos y seis palabras descriptivas después del número cuando sea posible;
- no añadir `v` al nombre de `release/*`: la rama es `release/0.1.1` y el tag correspondiente es `v0.1.1`;
- no reutilizar una rama para otro Issue o para otra versión;
- reservar `automation/*` para ramas creadas por GitHub Actions, no para desarrollo manual.

Ejemplos correctos:

```text
feature/12-copias-seguridad
fix/18-reconexion-movil
release/0.1.1
hotfix/24-arranque-tablet
automation/feedback-24
```

Ejemplos incorrectos:

```text
feature/copias-seguridad       # falta el número del Issue
feature/#12-copias             # no se escribe el símbolo #
Fix/18_Reconexión_Móvil        # mayúsculas, guiones bajos y caracteres no ASCII
release/v0.1.1                 # la v pertenece al tag, no a la rama
hotfix/24                      # falta una descripción
```

### Comandos de creación

Las ramas de funcionalidad y corrección normal se crean desde el último `dev` remoto:

```powershell
git switch dev
git pull --ff-only origin dev
git switch -c feature/12-copias-seguridad
```

Para una corrección se sustituye únicamente el último comando:

```powershell
git switch -c fix/18-reconexion-movil
```

Las ramas de publicación y los hotfixes se crean desde el último `main` remoto:

```powershell
git switch main
git pull --ff-only origin main
git switch -c release/0.1.1
```

Para un hotfix:

```powershell
git switch -c hotfix/24-arranque-tablet
```

Después de crear una rama manual se publica por primera vez con:

```powershell
git push -u origin <nombre-exacto-de-la-rama>
```

En `feature/*`, `fix/*` y `hotfix/*`, el número del Issue debe aparecer en el nombre de la rama y en el pull request. Una rama `release/*` agrupa una versión y enumera todos sus Issues en el cuerpo del PR.

## Flujo normal de un ticket

```text
Issue
  │
  ├─ Enviado
  ├─ Visto
  └─ En desarrollo
        │
        ▼
feature/* o fix/*
        │  pull request + CI
        ▼
       dev ───────────── otros cambios todavía en pruebas
        │
        │ cambio concreto probado y seleccionado
        ▼
release/* creada desde main
        │  incorporar solo los commits seleccionados y volver a validar
        ▼
pull request release/* → main
        │
        ▼
      main
        │  tag de versión aprobado
        ▼
GitHub Actions → APK firmado → GitHub Release
        │
        └─ éxito: Issue = Implementado
```

### 1. Inicio

1. Revisar el Issue y asignarlo.
2. Mantener `feedback-movil` y sustituir el estado anterior por `en-desarrollo`.
3. Actualizar `dev` desde su remoto.
4. Crear desde `dev` una rama `feature/*` o `fix/*`.

### 2. Desarrollo e integración

1. Implementar y validar el cambio en su rama temporal.
2. Abrir un pull request hacia `dev`.
3. Usar `Refs #<numero>` en el PR. No utilizar todavía `Fixes` o `Closes`, porque el cambio aún no está publicado.
4. Exigir al menos lint, pruebas y build antes de fusionar.
5. Fusionar en `dev` y eliminar la rama temporal cuando ya no sea necesaria.

Un cambio presente solamente en `dev` continúa en estado **En desarrollo**.

Una rama fusionada en `dev` puede convivir con otros trabajos que todavía estén en pruebas. Por eso no se fusiona `dev` completo en `main` ni se abre directamente un PR de la rama original hacia `main`: al partir de `dev`, esa rama podría arrastrar cambios ajenos.

No existe una detección automática de «trabajo terminado». La decisión de publicar es humana y no añade un quinto estado al móvil. Una incidencia permanece **En desarrollo** hasta que la Release que la contiene se publique correctamente.

### 3. Preparación de una versión

1. Probar en `dev` cada incidencia candidata, incluyendo la sincronización Android y las comprobaciones físicas que correspondan.
2. Elegir expresamente el número de versión.
3. Crear `release/<version>` desde el último `main`, nunca desde `dev`.
4. Incorporar únicamente los commits de las incidencias aprobadas. Se recomienda usar squash al fusionar cada PR hacia `dev`, de modo que cada Issue pueda trasladarse como un único commit mediante `cherry-pick`.
5. Resolver dependencias explícitamente: si un cambio necesita otro, ambos deben entrar en la misma Release.
6. Volver a ejecutar todas las validaciones sobre `release/<version>`.
7. Abrir un pull request de `release/<version>` hacia `main`.
8. Enumerar en el cuerpo del PR las incidencias incluidas bajo el encabezado `Incidencias incluidas`.
9. Fusionar únicamente cuando las validaciones sean correctas.

Ejemplo de cuerpo del PR:

```markdown
## Incidencias incluidas

- #18
- #21

## Validación

- npm run lint
- npm test
- npm run build
- npx cap sync android
```

### 4. Publicación

El tag se crea **después** de fusionar `release/<version>` en `main`, sobre el commit exacto que se va a distribuir:

```powershell
git switch main
git pull --ff-only origin main
git tag v0.1.1
git push origin v0.1.1
```

El tag `vX.Y.Z` ejecuta el workflow de publicación. Este debe:

1. instalar dependencias;
2. ejecutar lint, pruebas y build;
3. sincronizar y compilar Android;
4. firmar el APK con la clave oficial;
5. generar y verificar su SHA-256;
6. publicar el APK y su SHA-256 como Release de `Pablo-hg/Pablo-Tablet`;
7. solo después del éxito, añadir `implementado`, retirar los otros estados y cerrar las incidencias incluidas.

Si falla la compilación o la publicación, no existe una Release válida y las incidencias permanecen **En desarrollo**. La actualización de tickets se ejecuta en un trabajo separado después de publicar, por lo que puede reintentarse sin volver a crear la Release. Los tags publicados se consideran inmutables: si el código necesita otra corrección se prepara una versión posterior, sin mover ni reutilizar el tag anterior.

## Significado de los estados del móvil

| Estado visible | Significado operativo                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------- |
| Enviado        | El Issue se ha creado correctamente                                                                |
| Visto          | El desarrollador ha revisado y clasificado el reporte                                              |
| En desarrollo  | El trabajo ha comenzado o está integrado en `dev`, pero aún no existe una Release correcta         |
| Implementado   | La Release que contiene el cambio se ha publicado correctamente y está disponible para las tablets |

Cerrar o fusionar un PR no basta por sí solo para mostrar **Implementado**. El cambio de estado depende del éxito de la publicación.

## Versionado

Se utiliza versionado semántico `MAJOR.MINOR.PATCH`:

- `0.1.1`, `0.1.2`, etc.: correcciones compatibles dentro de la fase `0.1`;
- `0.2.0`: inicio aprobado de la fase `0.2` o conjunto relevante de nuevas funciones;
- `1.0.0`: primera versión considerada estable para uso general.

Mientras el producto esté en desarrollo inicial, cada publicación funcional puede incrementar `PATCH`, pero varios Issues pueden agruparse en una misma Release. Un merge en `dev` nunca incrementa automáticamente la versión.

## Hotfix urgente

Un fallo crítico de la versión publicada sigue un recorrido abreviado:

```text
main → hotfix/* → PR a main → tag → Release
                └────────────→ incorporar también a dev
```

El hotfix mantiene las mismas validaciones, firma y regla de etiquetado. Después de publicarlo, debe fusionarse o trasladarse a `dev` para evitar que la corrección desaparezca en la siguiente versión.

## Protecciones recomendadas en GitHub

- Prohibir pushes directos a `main`.
- Permitir en `main` únicamente PR desde `release/*` o `hotfix/*`.
- Exigir CI correcto antes de fusionar en `dev` y `main`.
- Mantener los tags `v*` protegidos e inmutables.
- No guardar claves, tokens ni contraseñas en ninguna rama.
- No publicar una Release hasta completar la firma definitiva y una instalación de prueba en la Teclast T65.

## Automatización y agentes

- `validate-pull-request.yml` valida los PR dirigidos a `dev` y `main`, acepta únicamente `release/MAJOR.MINOR.PATCH` o `hotfix/<issue>-<descripcion>` hacia `main` y exige que enumeren sus Issues bajo `Incidencias incluidas`, pero no publica versiones.
- `android-release.yml` se ejecuta solo con un tag `vX.Y.Z`, verifica que el commit pertenece a `main`, localiza el PR de `release/*` o `hotfix/*`, publica la Release y después actualiza los Issues de feedback enumerados.
- `feedback-to-markdown.yml` no escribe directamente en `main`: crea una rama automática y propone el Markdown mediante un PR hacia `dev`.
- El agente `Pablo Tablet Developer` puede implementar Issues y preparar PR hacia `dev`, pero no puede fusionar, publicar, crear tags ni marcar tickets como implementados.
- GitHub Actions es la autoridad determinista para validaciones y publicación. El agente es una ayuda opcional y su resultado siempre requiere revisión humana.

Ninguna automatización debe seleccionar por sí sola qué cambios de `dev` se publican, crear o fusionar el PR de publicación, elegir el número de versión o crear el tag. Esos pasos requieren una decisión expresa. La automatización comienza validando el PR y, después de enviar el tag, construye y publica la Release.

El workflow rechaza expresamente los PR directos de `dev`, `feature/*` o `fix/*` hacia `main`. Esto evita publicar por accidente otros cambios que sigan en pruebas dentro de `dev`.

Para que `feedback-to-markdown.yml` pueda abrir el PR, en **Settings > Actions > General > Workflow permissions** debe estar activa la opción **Allow GitHub Actions to create and approve pull requests**. No hay que guardar un token personal para este paso: el workflow utiliza el `GITHUB_TOKEN` temporal de la propia ejecución.

El perfil del agente solo aparecerá en GitHub Agents cuando `.github/agents/pablo-tablet.agent.md` haya llegado a la rama predeterminada (`main`). Su uso depende de que la cuenta tenga acceso a GitHub Copilot; no forma parte del mecanismo obligatorio de publicación ni se necesita para ejecutar los workflows.

## Adopción del flujo

El PR #2 y la incidencia #1 se integraron antes de aprobar este proceso. Se conservan como parte del historial y no se revierten de nuevo artificialmente. La rama `dev` se creó desde el `main` que ya contiene ese merge; todos los trabajos posteriores siguen este documento.
