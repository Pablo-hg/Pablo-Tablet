# Pruebas de Pablo Tablet

La suite automática utiliza **Vitest**, **JSDOM** y **React Testing Library**. Su objetivo es detectar regresiones en los datos persistidos, la lógica de los módulos y los flujos principales de la interfaz sin depender de Internet ni de una tablet conectada.

## Ejecución

```bash
# Ejecutar toda la suite una vez
npm test

# Volver a ejecutar las pruebas al guardar cambios
npm run test:watch

# Generar cobertura en coverage/index.html
npm run test:coverage
```

Antes de preparar una APK se recomienda ejecutar:

```bash
npm run lint
npm test
npm run build
```

## Validación automática de pull requests

El workflow `.github/workflows/validate-pull-request.yml` se ejecuta cuando se abre, se reabre o se actualiza una pull request cuyo destino es `dev` o `main`. También puede iniciarse manualmente desde GitHub Actions.

La validación realiza estos pasos, en este orden:

1. comprueba que la combinación de rama de origen y destino respeta el flujo documentado;
2. en una PR hacia `main`, comprueba que el apartado `Incidencias incluidas` enumera al menos un Issue;
3. instala exactamente las dependencias de `package-lock.json` con `npm ci`;
4. ejecuta el análisis estático con `npm run lint`;
5. ejecuta todas las suites de Vitest con `npm test`;
6. compila la aplicación web con `npm run build`;
7. sincroniza los recursos y plugins nativos con `npx cap sync android`;
8. compila un APK debug de validación con `./gradlew assembleDebug`.

El merge no inicia una ejecución adicional. Por eso la protección de las ramas debe exigir que el check **Validar pull request** termine correctamente antes de permitir la fusión. Fusionar una PR mientras el check sigue en curso no equivale a haberla validado.

Cuando se crea un tag `vX.Y.Z`, `.github/workflows/android-release.yml` vuelve a ejecutar `npm ci`, lint, todas las pruebas, el build web y la sincronización Android. Después compila el APK release firmado, genera su SHA-256 y publica la Release. Esta validación del tag no sustituye la validación previa de la PR.

## Cobertura funcional

### Migraciones y recuperación

Archivo: `src/test/dashboardState.test.ts`

- Migra la nota simple del almacenamiento v1 al modelo actual.
- Añade las páginas incorporadas por versiones posteriores sin reactivar módulos que el usuario había deshabilitado.
- Normaliza colores antiguos, días de alarmas, duraciones de temporizadores y posiciones de widgets.
- Recupera el estado por defecto cuando el JSON persistido está corrupto.

### Repeticiones del calendario

Archivo: `src/test/calendarRecurrence.test.ts`

- Repeticiones diarias y semanales.
- Repeticiones mensuales al final de meses cortos.
- Repeticiones anuales desde un 29 de febrero.
- Eventos recurrentes que duran varios días.
- Cálculo de la siguiente aparición y descarte de eventos únicos ya finalizados.

La lógica comprobada vive en `src/calendarRecurrence.ts` y es la misma que utiliza la interfaz.

### Estado del calendario móvil

Archivo: `src/test/mobileCalendar.test.js`

- Duración inclusiva de eventos de uno o varios días.
- Estado finalizado por fecha u hora de fin.
- Diferenciación entre tareas vencidas y completadas.
- Conservación de las series recurrentes como activas.

### Administración móvil

Archivo: `src/test/mobileAdminWeb.test.ts`

- Carga, edición y persistencia de los ajustes nocturnos desde el móvil.
- Presentación correcta del estado y duración de los eventos del calendario.
- Creación de comentarios mediante JSON UTF-8 sin exponer credenciales de GitHub.
- Ausencia de las acciones retiradas para copiar o descargar Markdown.
- Sincronización de los cuatro estados visibles del ticket y del mensaje de cambio de estado.
- Mantenimiento del WebSocket, envío de `ping` y recuperación de reconexiones breves.

### Modo nocturno

Archivo: `src/test/nightMode.test.ts`

- Activación correcta de un horario que cruza la medianoche.
- Aplicación de brillo y volumen nocturnos.
- Recuperación de los valores diurnos sin modificarlos ni perderlos.

### Layouts de widgets

Archivo: `src/test/widgetLayout.test.ts`

- Corrige posiciones fuera del grid.
- Restaura widgets incorporados en versiones posteriores.
- Recoloca widgets sin solapamientos.
- Rechaza configuraciones cuya superficie no cabe en el dashboard.

### Temporizadores

Archivo: `src/test/timerLogic.test.ts`

- Inicio desde la duración completa o desde una pausa.
- Cálculo del tiempo restante.
- Pausa conservando el tiempo correcto.
- Reinicio y reutilización después de finalizar.
- Detección de finalización y formato sin valores negativos.

La lógica comprobada vive en `src/timerLogic.ts` y se comparte con la página de reloj.

### Meteorología

Archivo: `src/test/weather.test.ts`

- Búsqueda de ubicaciones y descarte de coordenadas inválidas.
- Construcción correcta de URLs para Open‑Meteo.
- Transformación del tiempo actual y de las previsiones horarias y diarias.
- Errores HTTP y respuestas incompletas.

Las respuestas de Open‑Meteo se simulan dentro de la prueba. La suite nunca depende de la red ni consume el servicio real.

### Navegación y flujos principales

Archivo: `src/test/App.navigation.test.tsx`

- Navegación entre Inicio, Calendario y Tiempo mediante los indicadores de página.
- Apertura de Ajustes desde la navegación contextual y regreso al dashboard.
- Acceso a Notas, creación de una nota de texto, edición y persistencia local del contenido.
- Activación de la selección múltiple de Galería y Papelera mediante pulsación larga o botón, selección adicional, selección de todas y cancelación sin borrar fotos.

## Qué no sustituye esta suite

Las pruebas web no validan comportamientos exclusivos de Android. Antes de publicar una versión deben comprobarse en la Teclast T65:

- permisos y entrega real de notificaciones;
- alarmas y temporizadores con la pantalla apagada;
- reinicio del dispositivo;
- SQLite y migración desde una instalación anterior;
- importación, visualización y eliminación física de fotografías;
- brillo, volumen, vibración, modo kiosco y ahorro de batería;
- funcionamiento sin conexión durante varias horas.
- arranque del servidor local en el puerto 8765 y dirección IP mostrada en Ajustes;
- caducidad/cierre del QR, solicitud desde móvil y Permitir/Rechazar físicamente en la tablet;
- persistencia y revocación de una credencial después de reiniciar tablet y móvil;
- sincronización bidireccional y simultánea entre tablet y dos móviles;
- reconexión de WebSocket después de perder y recuperar la Wi‑Fi;
- subida y visualización móvil de fotografías grandes, y confirmación de que el archivo queda en el almacenamiento privado;
- pulsación larga, selección de varias fotos y movimiento conjunto a la papelera desde la Galería de la tablet;
- resolución mDNS/NSD y comportamiento real de `pablotablet.local` en la red doméstica;
- instalación o acceso desde pantalla de inicio del editor móvil en los navegadores objetivo.

Estas comprobaciones requieren dispositivo o emulador y deben registrarse en la validación de cada APK.
