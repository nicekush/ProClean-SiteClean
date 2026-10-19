# Despliegue de permisos — 19 de octubre de 2026

URL de producción: https://proclean-siteclean.vercel.app

## Publicado y verificado

- Código publicado en `main` mediante la integración GitHub/Vercel del proyecto
  original `proclean-siteclean`, equipo `esecor`.
- Firebase Authentication con correo y contraseña habilitado sin cambiar el plan.
- Las 11 cuentas existentes migradas conservando contraseñas e identificadores;
  se verificó el inicio de sesión de las 11 antes del agotamiento de cuota.
- Perfiles de Firestore sin contraseñas; los identificadores históricos de OT y
  responsables conservan su relación con las cuentas.
- Reglas e índices de Firestore publicados. Acceso anónimo rechazado.
- 1.421 OT, 1.421 detalles sin fotos, 1.421 vistas de métricas y 478 asignaciones
  con sus 478 vistas de cobertura. Cantidades conciliadas en producción.
- Ninguna OT requirió reparación de revisión tras la activación de las reglas.
- Alcance de contrato de las 1.128 auditorías antiguas conciliado mediante el
  respaldo, sin lecturas adicionales ni eliminación de registros.
- Prueba real desde el panel: creación de una cuenta temporal de consulta,
  guardado con auditoría, mapas/KPI y revocación en la sesión abierta. Firebase
  rechazó sus consultas de fotos, directorio, nómina y otra empresa, y sus
  intentos de administrar permisos. Cuenta temporal eliminada al terminar.
- 41 pruebas automáticas aprobadas. Interfaz probada en escritorio, móvil y
  React StrictMode con el emulador local. Compilación de producción aprobada.

## Respaldo

Antes de migrar se guardó fuera del repositorio un respaldo de 3.881 documentos
en 21 colecciones: `firestore-proclean-siteclean-2026-10-19T23-01-26-785Z.json`.
SHA256: `a8faadbf7c9885f4e24bf223784a7627261c4e8cf3be51dc4fbd07ba32be5fd0`.
Contiene datos privados y credenciales heredadas: no subirlo al repositorio.

## Incidencia pendiente: cuota gratuita de lecturas

Durante la migración y las verificaciones se agotó la cuota diaria gratuita de
lecturas. Firestore devolvió HTTP 429 / `RESOURCE_EXHAUSTED: Quota exceeded`.
La facturación del proyecto sigue deshabilitada. El código publicado y las reglas
están activos, pero el servicio de datos necesita la renovación de cuota o que
el propietario autorice habilitar facturación Blaze. No se contrató un plan pago.

Se corrigió la doble carga al iniciar sesión. Las suscripciones ya existentes no
se recrean por cambios irrelevantes del perfil; las consultas adicionales se
limitan a los módulos que se están usando. Las nuevas verificaciones se hicieron
solo contra el emulador local.

Después de recuperar cuota: ejecutar una única conciliación con `--repair-only`
y verificar inicio de sesión y consulta desde una sesión nueva, evitando repetir
cargas completas de producción. La migración ahora compara revisiones antes de
leer OT completas y agrupa las actualizaciones de alcance.

Dos contraseñas administrativas vigentes aparecían en el archivo de ejemplo del
repositorio público. Se retiraron del código actual, pero permanecen en el
historial: los titulares deben cambiarlas mediante la recuperación de contraseña.
