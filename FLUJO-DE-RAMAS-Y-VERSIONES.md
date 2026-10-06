# Flujo de ramas, versiones y tickets

Este documento define el proceso de trabajo de Pablo Tablet. Su objetivo es mantener `main` siempre estable y distribuible, probar conjuntamente los cambios antes de publicarlos y conservar la relación entre GitHub Issues, ramas, pull requests, versiones y APK.

La versión de producto actual continúa siendo `0.1.0`. Integrar código no cambia por sí solo ese número: una versión nueva existe cuando se crea un tag aprobado y el workflow publica correctamente su Release.

## Ramas permanentes

| Rama | Función | Qué puede entrar |
| --- | --- | --- |
| `main` | Estado estable y publicado del producto | Pull requests de publicación desde `dev` y hotfixes excepcionales |
| `dev` | Integración y validación de la siguiente versión | Pull requests procedentes de `feature/*` y `fix/*` |

No se desarrolla directamente sobre `main` ni sobre `dev`.

## Ramas temporales

- `feature/<issue>-<descripcion>`: funcionalidad nueva. Parte de `dev`.
- `fix/<issue>-<descripcion>`: corrección normal. Parte de `dev`.
- `hotfix/<issue>-<descripcion>`: corrección urgente de una versión ya publicada. Parte de `main` y, después de publicarse, también se incorpora a `dev`.

Ejemplos:

```text
feature/12-copias-seguridad
fix/18-reconexion-movil
hotfix/24-arranque-tablet
```

Siempre que el trabajo proceda de un Issue, su número debe aparecer en el nombre de la rama y en el pull request.

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
       dev
        │  pruebas conjuntas y validación en hardware cuando corresponda
        ▼
pull request de publicación
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

### 3. Preparación de una versión

1. Probar el contenido acumulado de `dev`, incluyendo la sincronización Android y las comprobaciones físicas que correspondan.
2. Elegir expresamente el número de versión.
3. Abrir un pull request de `dev` hacia `main`.
4. Enumerar en el cuerpo del PR las incidencias incluidas bajo el encabezado `Incidencias incluidas`.
5. Fusionar únicamente cuando las validaciones sean correctas.

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

El tag se crea **después** de fusionar `dev` en `main`, sobre el commit exacto que se va a distribuir:

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
6. publicar el APK en `Pablo-Tablet-Releases`;
7. solo después del éxito, añadir `implementado`, retirar los otros estados y cerrar las incidencias incluidas.

Si el workflow falla, la Release no se considera publicada y las incidencias permanecen **En desarrollo**. Los tags publicados se consideran inmutables: si el código necesita otra corrección se prepara una versión posterior, sin mover ni reutilizar el tag anterior.

## Significado de los estados del móvil

| Estado visible | Significado operativo |
| --- | --- |
| Enviado | El Issue se ha creado correctamente |
| Visto | El desarrollador ha revisado y clasificado el reporte |
| En desarrollo | El trabajo ha comenzado o está integrado en `dev`, pero aún no existe una Release correcta |
| Implementado | La Release que contiene el cambio se ha publicado correctamente y está disponible para las tablets |

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
- Permitir en `main` únicamente PR desde `dev` o `hotfix/*`.
- Exigir CI correcto antes de fusionar en `dev` y `main`.
- Mantener los tags `v*` protegidos e inmutables.
- No guardar claves, tokens ni contraseñas en ninguna rama.
- No publicar una Release hasta completar la firma definitiva y una instalación de prueba en la Teclast T65.

## Adopción del flujo

El PR #2 y la incidencia #1 se integraron antes de aprobar este proceso. Se conservan como parte del historial y no se revierten de nuevo artificialmente. La rama `dev` se creó desde el `main` que ya contiene ese merge; todos los trabajos posteriores siguen este documento.
