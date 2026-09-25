# Pablo Tablet — Especificación funcional consolidada

> Estado: decisiones funcionales cerradas para el MVP
> Actualizado: 18/09/2026
> Prevalencia: este documento y el README contienen los acuerdos vigentes. Los archivos de `chats/` son históricos, salvo `chats/08-arquitectura-tecnica.md`, que consolida la arquitectura tablet-móvil.

## 1. Alcance del MVP

El MVP incluye:

- dashboard y widgets;
- notas y recordatorios;
- reloj, alarmas y temporizadores;
- meteorología;
- calendario local;
- galería de imágenes y salvapantallas;
- administración desde móviles autorizados dentro de la red local;
- copias de seguridad y recuperación.

Google Calendar y los perfiles manuales o automáticos del dashboard se añadirán después del MVP.

## 2. Arquitectura funcional

- La Teclast T65 es el nodo central y la única fuente de verdad.
- La interfaz utiliza React dentro de Capacitor.
- Un servicio nativo Android ejecutará el servidor local, gestionará su autoarranque y lo recuperará ante fallos.
- La persistencia definitiva utilizará Room sobre SQLite.
- El editor móvil será una PWA servida por la tablet; no habrá aplicación móvil nativa.
- La API REST realizará consultas y modificaciones. WebSocket propagará los cambios en tiempo real.
- Si dos dispositivos modifican el mismo dato, prevalecerá el último cambio recibido por la tablet (`Last Write Wins`).
- El móvil no permitirá editar sin conexión. Al reconectarse volverá a cargar el estado vigente de la tablet.

## 3. Acceso, vinculación y seguridad

- El acceso se realizará mediante `pablotablet.local`, con la dirección IP local como alternativa.
- El móvil y la tablet deberán estar en la misma red local.
- La V1 utilizará HTTP local con un token largo, aleatorio, individual y revocable para cada dispositivo autorizado.
- El riesgo de que una persona con capacidad para interceptar el tráfico de la LAN capture una credencial se acepta para esta V1 doméstica.
- Para vincular un dispositivo se mostrará un QR con credencial temporal y se exigirá confirmación física en la tablet.
- El QR caducará cuando se use, se cierre su pantalla o transcurran 5 minutos, lo que ocurra primero.
- Una autorización se renovará automáticamente y seguirá siendo válida hasta que se revoque o se pierda la credencial del navegador.
- Todos los móviles autorizados tendrán los mismos permisos.
- No habrá PIN.
- Borrar datos, restaurar una copia, revocar dispositivos o restablecer la aplicación exigirá un mensaje de confirmación explícito. Si la acción se inicia desde un móvil autorizado, se confirmará en ese mismo móvil.

## 4. Datos, archivos y papelera

- Room almacenará los datos estructurados, configuraciones y metadatos.
- Las imágenes se copiarán al almacenamiento privado de Pablo Tablet y se conservarán con resolución y calidad originales.
- Room almacenará sus metadatos, álbumes y referencias.
- Una imagen podrá pertenecer a varios álbumes sin duplicar el archivo.
- Quitar una imagen de un álbum no la borrará de la galería.
- Al eliminar imágenes, notas o eventos pasarán a una papelera recuperable durante 30 días.
- El borrado de una imagen desde la galería la retirará de todos sus álbumes.

## 5. Copias de seguridad

- La copia automática incluirá todos los datos de usuario: imágenes, calendarios, notas, widgets, layouts, preferencias, configuración y demás contenido local.
- No incluirá tokens, sesiones de dispositivos ni otras credenciales sensibles.
- Las copias no estarán cifradas. Antes de exportarlas se advertirá que pueden contener información privada.
- Se realizará una copia automática cada domingo a las 03:00.
- Se conservarán las 3 últimas copias automáticas y se eliminarán las anteriores.
- Si la tablet no puede ejecutar la copia el domingo, la realizará la siguiente vez que se encienda.
- Restaurar una copia reemplazará completamente el estado actual, previa confirmación.
- La implementación de las copias queda programada para una fase posterior del desarrollo del MVP.

## 6. Notas y recordatorios

- Las notas admitirán negrita, cursiva, listas y enlaces.
- Podrán tener colores, fijarse, archivarse y asociarse a recordatorios.
- Una nota no se eliminará automáticamente al completar o vencer su recordatorio.
- Podrá marcarse como completada y mostrarse tachada hasta que se archive o elimine manualmente.

## 7. Alarmas y temporizadores

- Las alarmas podrán repetirse por días de la semana.
- Se podrán posponer 10 minutos por defecto, con una duración configurable para cada alarma.
- En modo nocturno o «no molestar», las alarmas no emitirán sonido y conservarán únicamente el aviso visual.
- Los temporizadores sí emitirán sonido en esos modos.

## 8. Meteorología

- Las ciudades se seleccionarán manualmente desde el móvil; no se utilizará el GPS de la tablet.
- Cada ciudad tendrá datos actuales y previsión de 7 días.
- El dashboard permitirá mostrar una o dos ciudades simultáneamente, elegidas por el usuario.
- La vista meteorológica completa permitirá consultar todas las ciudades guardadas.
- Sin Internet se mostrarán los últimos datos disponibles con un aviso de desactualización.

## 9. Calendario

- El MVP incluirá primero un calendario completamente local.
- Admitirá eventos normales y de día completo, repeticiones, recordatorios y colores.
- Tendrá vistas de día, semana, mes y agenda.
- Google Calendar y sus decisiones de cuentas, OAuth y sincronización bidireccional se abordarán después del MVP.

## 10. Galería y salvapantallas

- La galería admitirá únicamente imágenes, no vídeos.
- Se podrán añadir imágenes desde un móvil autorizado y desde la tablet.
- El salvapantallas se activará tras 3 minutos de inactividad por defecto; el tiempo podrá cambiarse desde el móvil.
- El primer toque cerrará el salvapantallas sin ejecutar acciones sobre el panel situado debajo.
- Las imágenes cambiarán cada 15 segundos.
- Se mostrarán aleatoriamente y no se repetirá ninguna hasta haber recorrido todas las seleccionadas.
- Si no hay imágenes disponibles, se mostrarán el reloj y la fecha sobre un fondo oscuro.

## 11. Interfaz, temas y modo nocturno

- Se ofrecerán varios temas visuales prediseñados.
- La creación libre de temas personalizados queda fuera del MVP.
- El modo nocturno utilizará un horario fijo configurable, de 23:00 a 07:00 por defecto.
- Durante el modo nocturno se mostrará únicamente un reloj tenue sobre fondo negro; se ocultarán fotos, widgets e información privada.
- Los perfiles manuales y automáticos del dashboard quedan pospuestos para una versión posterior.

## 12. Actualizaciones

- En la V1, Pablo Tablet se actualizará instalando manualmente una APK nueva.
- La actualización deberá conservar los datos existentes mediante migraciones compatibles.
- Las actualizaciones automáticas quedan para una versión posterior.

## 13. Decisiones que no requieren definición funcional

El puerto local, las librerías concretas, la estructura de procesos, el formato binario o textual de los mensajes, el esquema interno de tokens y otros detalles equivalentes se elegirán durante la implementación. No modifican el comportamiento funcional acordado en este documento.
