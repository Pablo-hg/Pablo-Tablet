# Configuración remota y estado operativo

> Versión de producto: `0.1.0`
>
> Actualizado: 06/10/2026

Esta guía reúne la configuración externa necesaria para reproducir las actualizaciones y los comentarios remotos. No contiene valores de secretos. Cada persona que instale su propia copia debe crear sus credenciales, su Worker y, si desea publicar APK, su repositorio de Releases.

## Estado de la instalación de referencia

| Elemento | Estado actual |
| --- | --- |
| Repositorio público `Pablo-hg/Pablo-Tablet` | Operativo |
| Ramas `dev` y `main` | Operativas; `dev` puede contener varios trabajos en pruebas |
| Ramas de publicación `release/*` | Flujo documentado; adaptación de workflows pendiente |
| Validación de PR con GitHub Actions | Operativa para el flujo actual; adaptación de `release/*` pendiente |
| Worker de Cloudflare para feedback | Desplegado |
| Creación real de GitHub Issues desde el móvil | Validada con el Issue #1 |
| Etiquetas `feedback-movil`, `visto`, `en-desarrollo`, `implementado` | Creadas |
| Markdown automático del feedback | Configurado; solo se ejecuta al aplicar `implementado` |
| Publicación automática de APK por tag | Workflow preparado |
| Repositorio `Pablo-Tablet-Releases` y primera Release firmada | Pendiente de completar y validar |
| Protecciones de ramas y tags | Recomendadas; comprobar manualmente en GitHub |

## 1. Etiquetas de Issues

Crear estas etiquetas en **Settings → Issues → Labels**:

- `feedback-movil`: identifica tickets creados desde una instalación;
- `visto`: el desarrollador ha revisado el ticket;
- `en-desarrollo`: el trabajo ha empezado o está integrado en `dev`;
- `implementado`: una Release que contiene el cambio se publicó correctamente.

Solo esos cuatro estados se muestran al usuario del móvil. Las condiciones internas `pending` y `failed` pertenecen al transporte y permiten reintentar; no son estados del ticket.

## 2. Cloudflare Worker

1. Crear un token fine-grained de GitHub limitado a `Pablo-Tablet` con permiso **Issues: Read and write**.
2. Desplegar el contenido de `feedback-relay/` como Cloudflare Worker.
3. Guardar como secretos cifrados del Worker:
   - `GITHUB_TOKEN`: token limitado a Issues;
   - `FEEDBACK_RELAY_KEY`: clave aleatoria de al menos 32 caracteres.
4. No copiar ninguno de esos valores al repositorio ni a la interfaz móvil.

Los comandos reproducibles y el contrato del servicio están en [feedback-relay/README.md](feedback-relay/README.md).

## 3. Secretos de GitHub Actions

En **Settings → Secrets and variables → Actions** deben existir:

| Secreto | Uso |
| --- | --- |
| `FEEDBACK_RELAY_URL` | URL HTTPS del Worker desplegado |
| `FEEDBACK_RELAY_KEY` | Misma clave de entrada configurada en el Worker |
| `ANDROID_KEYSTORE_BASE64` | Almacén de firma Android codificado en Base64 |
| `ANDROID_KEYSTORE_PASSWORD` | Contraseña del almacén |
| `ANDROID_KEY_ALIAS` | Alias de la clave |
| `ANDROID_KEY_PASSWORD` | Contraseña de la clave |
| `UPDATE_REPO_TOKEN` | Publicar Releases en `Pablo-Tablet-Releases`; permiso mínimo `Contents: Read and write` |

El repositorio puede ser público, pero estos valores siguen siendo secretos y nunca deben aparecer en commits, Issues, logs o documentación.

## 4. Permisos de Actions

En **Settings → Actions → General → Workflow permissions**:

- mantener los permisos mínimos que permitan ejecutar los workflows;
- activar **Allow GitHub Actions to create and approve pull requests** para que `feedback-to-markdown.yml` pueda proponer el Markdown mediante un PR hacia `dev`.

El workflow utiliza el `GITHUB_TOKEN` temporal de la ejecución para ese PR; no necesita un token personal adicional.

## 5. Ramas, reglas y publicación

La nomenclatura obligatoria es:

- `feature/<issue>-<descripcion>` y `fix/<issue>-<descripcion>`, creadas desde `dev`;
- `release/<major>.<minor>.<patch>` y `hotfix/<issue>-<descripcion>`, creadas desde `main`;
- minúsculas, descripción sin espacios ni tildes y palabras separadas por guiones;
- rama `release/0.1.1`, pero tag `v0.1.1`.

Los ejemplos válidos, casos incorrectos y comandos exactos están en [FLUJO-DE-RAMAS-Y-VERSIONES.md](FLUJO-DE-RAMAS-Y-VERSIONES.md).

Configurar Rulesets o protecciones equivalentes para:

- impedir pushes directos a `main`;
- exigir PR y CI correcto para `dev` y `main`;
- aceptar en `main` únicamente PR desde `release/*` o `hotfix/*`;
- proteger los tags `v*` para que no se muevan ni reutilicen.

La aplicación no interpreta un merge en `dev` como una nueva versión. El recorrido es deliberadamente manual hasta la publicación:

```text
feature/fix → PR a dev → pruebas
                          ↓ seleccionar solo cambios terminados
main → release/X.Y.Z → PR a main → merge → tag vX.Y.Z
                                             ↓
                             GitHub Actions publica la Release
                                             ↓
                              Issues pasan a Implementado
```

No hay una etiqueta visible «terminado» ni un workflow que elija automáticamente qué sale de `dev`. Cada `release/*` se crea desde `main` e incorpora solo los commits ya probados. Los workflows todavía deben adaptarse a este nuevo recorrido antes de la primera publicación. El detalle está en [FLUJO-DE-RAMAS-Y-VERSIONES.md](FLUJO-DE-RAMAS-Y-VERSIONES.md).

## 6. Comprobación inicial

Antes de considerar operativo un nuevo despliegue:

1. Enviar un comentario de prueba desde un móvil vinculado.
2. Confirmar que se crea un único Issue con `feedback-movil`.
3. Aplicar sucesivamente `visto` y `en-desarrollo` y comprobar el mensaje en el móvil.
4. No aplicar `implementado` hasta que exista una Release correcta que contenga el cambio.
5. Publicar una versión de prueba siguiendo [ACTUALIZACIONES.md](ACTUALIZACIONES.md).
6. Comprobar descarga, SHA-256, firma, instalación y conservación de datos en una tablet física.

Si el Worker falla, el reporte permanece en la cola local y puede reintentarse. Si la publicación del APK falla, los Issues permanecen **En desarrollo**.
