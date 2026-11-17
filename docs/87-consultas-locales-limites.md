# Consultas locales de Lumi: límites y garantías

## Recurrencias

El modelo local solo guarda una frecuencia diaria, semanal, mensual o anual; no guarda fin de serie ni excepciones por ocurrencia. Las series locales se calculan con esa frecuencia y no permiten representar una cancelación o modificación aislada. Las reglas complejas de proveedores tampoco se representan fielmente.

El relay solicita ocurrencias individuales a Google (`singleEvents`) y una vista por periodo a Outlook. Eso no demuestra soporte completo de excepciones: los adaptadores no conservan el identificador de la serie ni la fecha original de cada excepción, y la sincronización debe manejar correctamente cambios, cancelaciones, ventanas y cursores. Una ocurrencia modificada o cancelada puede no reflejarse como se espera. No se promete soporte hasta implementar y probar el ciclo completo, incluidos datos reales. Lumi advierte al consultar la agenda si hay una cuenta externa habilitada o datos externos guardados, incluso si la cuenta figura conectada y la respuesta está vacía. La advertencia también recuerda que la caché puede ser antigua; estar conectado no garantiza su actualidad.

## Resultados y privacidad

- Las búsquedas de tareas muestran todas las coincidencias guardadas, ordenadas por fecha y título. Si hay más de diez o la respuesta supera 2000 caracteres, la voz indica el número y remite a la lista escrita. No se ofrece paginación; una lista grande puede ocupar mucho espacio.
- Las consultas de agenda admiten intervalos de hasta 32 fechas inclusive y muestran todos los resultados escritos; las respuestas habladas largas remiten al chat. Las búsquedas de notas muestran como máximo el límite solicitado (hasta diez), y solo las primeras cinco se ofrecen para seleccionar en seguimiento. Si hay más coincidencias se pide afinar la búsqueda. Una lectura ambigua también muestra como máximo cinco candidatos y advierte si hay más.
- Las búsquedas de notas omiten notas archivadas; las tareas y la agenda omiten elementos pendientes de eliminación. Los estados vacíos indican que no se encontraron datos locales, sujetos a las advertencias de calendarios externos.
- Los comandos se validan por tipo, argumentos y límites antes de ejecutarse. Las consultas de calendario, tareas, notas y reloj leen el estado local y no lo modifican; las escrituras requieren confirmación separada. El texto y voz comparten la ejecución. El reconocimiento de voz depende del servicio configurado en el dispositivo y no se garantiza que sea offline. La consulta de previsión de la semana siguiente puede solicitar datos de red: no se incluye en la garantía de consultas locales de esta tarea.
- Las pruebas automatizadas usan datos simulados. No sustituyen la comprobación de cuentas conectadas reales ni la validación física de todas las frases y presentaciones en Android.
