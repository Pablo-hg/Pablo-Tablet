# Lumi: acciones locales de la tarea 88

Este incremento amplía el intérprete local basado en patrones; no entrena un modelo ni comprende lenguaje libre. La evaluación de un motor conversacional se sigue en #101.

## Acciones incorporadas

- Crear eventos locales con inicio y fin, tareas y cumpleaños anuales con propuesta y confirmación. Se admite un conjunto acotado de expresiones y se rechazan horas ambiguas.
- Renombrar o completar una tarea local sin recurrencia, renombrar un evento local sin recurrencia y renombrar una nota activa. La propuesta identifica el registro; una coincidencia múltiple o un cambio posterior impide ejecutar la modificación.
- Lectura hablada natural de propuestas; el guardado web se intenta antes de comunicar éxito. La protección de propuestas repetidas utiliza un identificador en memoria durante la sesión.
- Pablo ha probado en web los flujos de creación de eventos, tareas y cumpleaños, cambio de nombre de eventos, confirmación y presentación. Las frases de creación de notas y su lectura se han afinado después de su feedback; falta confirmar manualmente las últimas modificaciones.

## Límites pendientes

- La idempotencia no es persistente frente a reinicios o reconstrucciones posteriores de la sesión. Dos peticiones nuevas con el mismo contenido se consideran acciones diferentes.
- En Android la escritura nativa sigue realizándose por el mecanismo general de persistencia y no se espera su confirmación antes de anunciar éxito. La coordinación con otras escrituras y administración móvil requiere trabajo específico. No se ha validado este incremento en T65.
- No se implementan aquí la cancelación o el borrado de eventos/tareas, la modificación del contenido de notas, el cambio de fecha/hora ni las acciones en Google/Outlook. No se deben cerrar los criterios pendientes de #88.
- La comprobación de unicidad utiliza los registros presentes en el estado local; al haber coincidencias en la misma fecha exige desambiguar manualmente. No se modifica una serie repetitiva ni una cuenta externa.
