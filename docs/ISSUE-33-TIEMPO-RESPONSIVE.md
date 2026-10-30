# Issue #33: Tiempo responsive sobre la versión publicada

## Causa de la diferencia

La versión `v0.4.8` se publicó desde `main` con la selección del PR #76. Las mejoras meteorológicas que estaban en `dev`, junto con la #30, quedaron expresamente fuera de esa selección. En la versión publicada faltaban `src/pages/WeatherPage.css`, su importación, la marca `is-weather` del contenedor y la estructura nueva de la previsión por horas. La fotografía recibida corresponde al diseño anterior.

También se comprobó que el servidor local que escuchaba en `127.0.0.1:5173` procedía de `C:\Users\Pablo\.codex\worktrees\issue-61-installed-release-notes\Tablet`. Se conservó intacto. La revisión de este parche utiliza el checkout canónico `C:\Users\Pablo\Desktop\Pablo-Tablet` y un servidor independiente en `127.0.0.1:5188`.

## Corrección

La rama `hotfix/33-tiempo-responsive` parte de `origin/main` en `01cbdb860e84a162a5fbb55e5fe18ba68399e133`, el merge de publicación de la 0.4.8.

- Se recupera únicamente la vista meteorológica de `dev`, sus datos horarios de día/noche y cuatro traducciones. No se copia `App.tsx` completo ni el resto del CSS de desarrollo.
- Se ajusta la distribución según el ancho efectivo del contenido, incluyendo navegación lateral y texto ampliado. Se usan consultas de contenedor en el área principal y en las tarjetas.
- La previsión ocupa dos columnas cuando hay espacio y se apila cuando falta ancho. Si falta altura, el contenedor de la página permite desplazamiento vertical; las tarjetas conservan la altura necesaria para su contenido.
- Se muestran las doce horas de detalle y los siete días, sin ocultar horas para forzar que quepan. Las columnas horarias se adaptan al ancho de su tarjeta.
- Humedad, viento, amanecer y anochecer separan etiqueta y valor. Los nombres largos y las descripciones se pueden partir sin superponerse.
- Las máximas y mínimas pasan a una segunda línea en las tarjetas estrechas. Las temperaturas negativas se ajustan también con tipografía monoespaciada y texto grande.
- Se reserva espacio bajo la navegación para alcanzar el último día y el pie de Open-Meteo.

Las consultas de contenedor sustituyen las reglas anteriores que dependían solo de la orientación y de la resolución total. Esas reglas antiguas fallaban con ventanas bajas y texto ampliado, aunque el caso habitual de escritorio pareciera correcto.

## Alcance y datos

No se incorporan tonos, temporizadores, widgets, parches nativos de notificaciones ni otros cambios de la #30. `package.json`, el lockfile, Java/Kotlin de la aplicación, los workflows y los archivos Gradle conservan el contenido de `main`.

No se cambian la persistencia general, las notas, las preferencias, las ubicaciones guardadas ni sus claves de almacenamiento. El dato horario `isDay` es opcional: las previsiones anteriores en caché siguen siendo válidas, con el amanecer y el anochecer como alternativa.

El arreglo del actualizador, commit `18d87ac`, se conserva en `fix/33-verificacion-actualizacion`; esta rama no lo pierde ni lo integra de forma implícita.

## Validación

- `npm ci` con el package y lockfile de `main`, sin parches nativos de la #30.
- Lint y build con TypeScript correctos.
- 171 pruebas web en 31 archivos: correctas.
- Capacitor sync, Android Lint, 38 pruebas JVM y `assembleDebug`: correctos.
- Matriz principal: 1.008 combinaciones, cero fallos.
- Temas, idiomas y contenido largo: 360 combinaciones, cero fallos.
- Las 1.368 combinaciones finales se ejecutaron contra el build compilado mediante `vite preview`, no contra el servidor de desarrollo.
- Comparación de rutas excluidas respecto de `main` y `git diff --check`: correctas.

La matriz principal comprende 21 tamaños entre 360×800 y 2560×1600, ambas orientaciones, los cuatro estilos de navegación en sus cuatro posiciones y texto a 16, 20 y 24 px. Son 1.008 combinaciones.

La matriz adicional comprende los diez temas, español e inglés, seis tamaños, tres escalas de texto, navegación lateral, nombres largos, temperaturas negativas, viento de tres cifras y descripciones de tormenta. Son 360 combinaciones adicionales.

Se comprueba desbordamiento horizontal, recorte dentro de tarjetas, separación de etiquetas y valores, conservación de las doce horas y los siete días, superposición del último día con el pie y acceso al pie sin que la navegación lo tape.

Las capturas se guardan en `output/playwright/weather33-*.png`. El script reutilizable está en `scripts/qa/weather-responsive.js`. Los datos meteorológicos son simulados únicamente en una sesión aislada de navegador; no se utilizan ni modifican los datos de la tablet.

## Repetir la revisión visual

Arrancar el proyecto o su build en el puerto indicado y abrir una sesión de navegador independiente:

```powershell
npx --yes --package @playwright/cli playwright-cli -s=weather-qa open http://127.0.0.1:5188 --headed
```

Para cada lote normal, usar `qa-weather-chunk` de 0 a 3:

```powershell
npx --yes --package @playwright/cli playwright-cli -s=weather-qa localstorage-set qa-weather-mode normal
npx --yes --package @playwright/cli playwright-cli -s=weather-qa localstorage-set qa-weather-chunk 0
npx --yes --package @playwright/cli playwright-cli -s=weather-qa run-code --filename scripts/qa/weather-responsive.js
```

Para la matriz de temas e idiomas, usar `qa-weather-mode stress` y lotes de 0 a 4. El script falla si una combinación recorta o tapa contenido.

## Publicación y comprobación física

Este parche no cambia los artefactos ya publicados de la 0.4.8. Quedan pendientes su integración/publicación en otra versión y la comprobación física en la Teclast T65 mediante el flujo visible de actualización. La conexión ADB disponible no estaba autorizada; no se ha instalado ningún APK ni se han cambiado ajustes del dispositivo.


## Integración posterior en dev: PR #78

Para resolver el PR se incorpora `dev` a esta rama mediante un merge, sin reescribir el historial. Se conserva la versión nueva de `WeatherPage.css`, la limpieza de listeners de notificaciones de `dev` y todas sus funciones ya existentes. También se conservan las protecciones de idioma y purga de fotos de `main` hasta recuperar los datos Android, junto con sus tres pruebas adicionales de arranque y conservación de datos.

Las traducciones meteorológicas y los iconos nativos que Git había duplicado al combinar ambos historiales se deduplican. Las pruebas y la implementación de recordatorios, temporizadores, tonos y widgets mantienen el contenido de `dev`.

La exclusión de otras funciones de la #30 descrita arriba corresponde al parche original preparado sobre `main`. Tras este merge, la rama es una integración hacia `dev`; no debe reutilizarse como selección aislada para una release hacia `main`. Esta integración no publica una nueva versión ni valida físicamente la tablet.
