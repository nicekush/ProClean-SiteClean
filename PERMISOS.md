# Usuarios y permisos

El panel está en **Configuración General → Usuarios**. Permite seleccionar una
cuenta, aplicar una plantilla, personalizar permisos, limitar el contrato y las
áreas operacionales, y activar o retirar su acceso. Cada guardado espera la
confirmación de Firestore y escribe la auditoría en el mismo lote.

## Comportamiento

- El catálogo contiene 46 permisos. Se encuentra en `src/security/catalog.json`.
- Los roles existentes conservan una plantilla inicial en `roleDefaults.json`.
  Una lista explícita de permisos sustituye esa plantilla; una lista vacía no
  concede acceso a módulos.
- **Cliente — Solo lectura** habilita consulta de OT, mapas y KPI. No incluye
  fotografías, firmas, exportaciones, edición ni administración.
- Activar un permiso añade sus requisitos. Quitar un requisito muestra los
  permisos dependientes que también se retirarán del borrador.
- Las plantillas personalizadas se guardan en `permission_profiles`. Son copias
  al aplicarlas: modificar una plantilla no modifica usuarios ya configurados.
- El administrador solo puede otorgar permisos que posee y un alcance igual o
  más limitado al suyo. La cuenta principal y los accesos propios están
  protegidos contra desactivación, eliminación o cambio de permisos en el panel.
- Crear cuentas y asignar permisos son facultades independientes. Un operador
  que solo puede crear cuentas las crea sin permisos; un administrador debe
  habilitar después sus accesos.
- El paquete de producción no incluye usuarios, contraseñas ni registros del
  archivo local de ejemplo; el logo se distribuye como recurso independiente.
- Los cambios de perfil se escuchan en tiempo real. Cambiar permisos o alcance
  cancela las consultas anteriores y limpia sus datos en la aplicación.
- Retirar acceso elimina el perfil autorizado. La identidad de Firebase Auth
  permanece, sin acceso a datos; para bajas habituales conviene desactivar.
- Los permisos de exportación controlan las funciones de descarga de la app.
  La información que se permite consultar puede ser copiada por quien la ve.

## Datos y límites

La empresa (`tenantId`) siempre se aísla. Contrato y áreas se aplican a las OT y
a sus mapas, indicadores y exportaciones. La dotación y auditoría se limitan
por contrato; sus áreas de cobertura son un catálogo distinto de las áreas de
planta. La estructura de planta, flota, turnos y configuración son referencias
compartidas dentro de la empresa. Las nóminas requieren permisos independientes.

Los datos operacionales se dividen en:

- `work_orders`: registro completo, con fotos y firma; requiere ver OT y evidencias.
- `work_order_details`: detalle de OT sin imágenes ni firma.
- `work_order_metrics`: datos de producción y estado de evidencia para mapas/KPI;
  excluye nombres de autores, texto de actividad, fotografías y firma.
- `coverage_public`: cobertura sin nombres, identificadores de personas ni correo.

Las OT y sus dos vistas se guardan y eliminan atómicamente. Las reglas verifican
que las vistas coincidan con el registro original y no incluyan campos privados.
Se requiere una revisión nueva en cada escritura para mantener las tres copias
actualizadas. Los permisos se verifican también en Firestore.

## Activación

Las compilaciones de producción exigen Firebase Authentication, incluso si una
variable antigua de Vercel indica lo contrario. La autenticación heredada solo
está disponible para desarrollo local. Antes de publicar, seguir
`FIREBASE_AUTH_ROLLOUT.md`: respaldo, cuentas reales, perfiles por UID y vistas.
Verificar una cuenta principal activa antes del cambio.

Después, en un proyecto de pruebas:

1. Ejecutar las verificaciones indicadas abajo.
2. Revisar la asignación real de contratos. `DEFAULT_CONTRACT_ID` debe apuntar al
   contrato de los documentos antiguos que no lo tengan; no inferirlo en una
   empresa con varios contratos sin revisar sus registros.
3. Ejecutar la migración de vistas con una credencial administrativa externa al
   repositorio. El modo predeterminado solo inspecciona el archivo local y no
   escribe en Firebase:

   ```powershell
   npm run migrate:permission-views
   $env:FIREBASE_PROJECT_ID = '<proyecto-de-pruebas>'
   $env:DEFAULT_CONTRACT_ID = 'c1'
   $env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\secure\firebase-admin.json'
   npm run migrate:permission-views -- --apply --confirm-project=<proyecto-de-pruebas>
   ```

4. Publicar una vista previa sin API REST
   heredada. Desplegar reglas e índices con la configuración de `firebase.json`.
5. Probar creación/edición/aprobación de OT y lectura del cliente desde sesiones
   distintas. Confirmar que las cantidades y KPI coincidan antes y después.
6. Repetir el procedimiento verificado en producción durante la ventana de
   activación coordinada del documento de autenticación. Exigir recarga de las
   pestañas anteriores: las escrituras antiguas no generan las vistas nuevas.

La migración usa transacciones sobre la última versión de cada documento, conserva
las OT y añade las vistas. Puede repetirse. No elimina cuentas ni registros
operacionales. Hacerla antes de habilitar usuarios externos.

## Verificación

```powershell
npm run test:permissions
npm run test:rules
npm run check:rules
npm run build
```

Las reglas se generan desde el mismo catálogo y las mismas plantillas utilizadas
por la interfaz: después de cambiar esos archivos, ejecutar
`npm run generate:rules`. El emulador requiere Java 21. En Windows, si el entorno
MSIX impide crear su socket local, configurar para esa sesión de pruebas un
directorio temporal corto y `JAVA_TOOL_OPTIONS` con
`-Djdk.net.unixdomain.tmpdir=<directorio> -Duser.language=en -Duser.country=US`.
