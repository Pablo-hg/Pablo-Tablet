# Calendario e integración Google

> **Documento histórico.** Google Calendar quedó pospuesto hasta después del MVP. Para el alcance vigente del calendario local, consulta [la especificación funcional](../ESPECIFICACION-FUNCIONAL.md).

- Proyecto de origen: ChatGPT / Pablo Tablet
- ID de conversación: `6aaa7252-e4bc-83ed-bb67-fe89cc6426cd`
- Creado: 2026-09-16T10:41:24.382Z
- Actualizado: 2026-09-16T10:44:07.446Z

---

## Usuario

Calendario e integración con Google

## Asistente

Perfecto. Dejamos este hilo de **Pablo Tablet** centrado en **calendario e integración con Google**.

Yo plantearía este módulo así:

- **Calendario local + Google Calendar**, para que la tablet siga funcionando aunque no tenga Internet.
- Vistas **día, semana, mes y agenda**.
- Mostrar eventos de **varios calendarios** con colores distintos.
- Crear, editar y borrar eventos desde la tablet y desde el móvil.
- **Sincronización bidireccional** con Google Calendar.
- Soporte para eventos:
  - título
  - descripción
  - ubicación
  - fecha/hora
  - todo el día
  - repetición
  - recordatorios
  - calendario al que pertenece
- En el **dashboard principal**, widget configurable con:
  - próximo evento
  - próximos 3–5 eventos
  - agenda del día
  - mini calendario mensual
- Integración con el módulo de reloj para que pueda mostrar algo como **“Próximo evento: Dentista · 17:30”**.
- Integración con notas/recordatorios locales para que puedan coexistir en una misma agenda.
- Caché local para consultar la agenda sin conexión.
- Si hay cambios offline, guardarlos en cola y sincronizarlos al recuperar Internet.

Para una tablet doméstica, además, veo muy útil contemplar **varias cuentas/personas**: por ejemplo, calendario personal, familiar, cumpleaños, trabajo, etc., pudiendo elegir cuáles aparecen en cada widget.

Para la autenticación con Google, mi preferencia sería que **no tengas que escribir la contraseña en la tablet**. Lo ideal sería iniciar la vinculación desde el móvil —por QR o flujo OAuth— y que la tablet reciba únicamente la autorización necesaria.

También te he dejado disponible la conexión con **Google Calendar** en ChatGPT, porque nos puede servir más adelante para probar comportamientos con calendarios reales directamente desde aquí.

Lo siguiente que conviene decidir es **cómo quieres que funcione la parte multiusuario**: una sola cuenta de Google con varios calendarios, o permitir conectar varias cuentas de Google simultáneamente.

## Usuario

https://chatgpt.com/share/6aaa728f-ba28-83eb-a0b7-aff3359efef7 
Usa esta conversación únicamente como contexto del proyecto **Pablo Tablet**. No hagas nada todavía, no desarrolles código ni tomes nuevas decisiones. Limítate a confirmar que has entendido el contexto y espera mis siguientes instrucciones.

## Asistente

Entendido. Usaré esa conversación únicamente como contexto del proyecto **Pablo Tablet** y, por ahora, no desarrollaré código ni tomaré decisiones nuevas.

Espero tus siguientes instrucciones.
