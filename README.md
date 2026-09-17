# SqlDataImporter

**SqlDataImporter** es una herramienta web desarrollada en ASP.NET Core que permite generar e importar plantillas de datos de forma dinámica, conectándose directamente a un servidor SQL Server.

## ¿Qué hace?

- 🔌 **Conexión dinámica** a cualquier servidor SQL Server (servidor, usuario y contraseña configurables).
- 🗄️ **Exploración de bases de datos**: lista las bases disponibles en el servidor conectado.
- 📋 **Lectura de esquema**: detecta automáticamente las tablas y columnas de la base seleccionada.
- 📥 **Generación de plantillas**: crea archivos Excel (.xlsx) o CSV con las columnas exactas de la tabla elegida, listos para llenarse.
- 📤 **Importación de datos**: permite subir el Excel/CSV ya lleno y cargarlo de vuelta a la tabla correspondiente en SQL Server.

## ¿Para qué sirve?

Elimina la necesidad de escribir scripts SQL manuales o mantener plantillas estáticas desactualizadas. Cualquier cambio en el esquema de la base de datos (nueva columna, tabla nueva, etc.) se refleja automáticamente en las plantillas generadas.

## Tecnologías

- ASP.NET Core MVC
- SQL Server
- Bootstrap 5
- ClosedXML

## Flujo de uso

1. **Conectar** — Ingresa los datos del servidor SQL.
2. **Seleccionar base de datos** — Elige la base a trabajar.
3. **Seleccionar tabla** — Elige la tabla cuya estructura quieres exportar o importar.
4. **Descargar plantilla** o **Importar datos** ya existentes en Excel/CSV.
