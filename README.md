# SqlDataImporter

**SqlDataImporter** es una herramienta web desarrollada en ASP.NET Core que permite conectarse dinámicamente a servidores SQL Server para generar plantillas, importar datos y construir reportes de forma visual.

## ¿Qué hace?

- 🔌 **Conexión dinámica a SQL Server**  
  Permite indicar servidor, usuario y contraseña para conectarse a distintas instancias.

- 🗄️ **Exploración de bases de datos**  
  Lista las bases de datos disponibles en el servidor conectado.

- 📋 **Lectura dinámica del esquema**  
  Detecta automáticamente esquemas, tablas, columnas y tipos de datos.

- 📥 **Generación de plantillas**  
  Permite descargar archivos Excel (`.xlsx`) o CSV con las columnas de la tabla seleccionada.

- 📤 **Importación de datos**  
  Permite cargar archivos Excel o CSV y validar su estructura antes de insertar la información en SQL Server.

- 📊 **Generación dinámica de reportes**  
  Permite construir reportes sin escribir consultas SQL manualmente.

  El generador permite configurar:

  - Columnas a mostrar.
  - Alias de columnas.
  - Relaciones entre tablas mediante `JOIN`.
  - Múltiples relaciones hacia la misma tabla.
  - Filtros.
  - Métricas como `SUM`, `COUNT`, `AVG`, `MIN` y `MAX`.
  - Columnas condicionales mediante expresiones `CASE WHEN`.
  - Columnas combinadas mediante concatenación.
  - Orden personalizado de las columnas de salida.

- 📁 **Exportación de reportes**  
  Los reportes generados pueden visualizarse mediante una vista previa y exportarse en formato Excel o CSV.

## ¿Para qué sirve?

SqlDataImporter busca reducir la necesidad de escribir scripts SQL manuales y mantener plantillas estáticas.

Al trabajar directamente con la metadata de SQL Server, cualquier cambio realizado en la estructura de la base de datos, como nuevas tablas o columnas, puede reflejarse dinámicamente en la aplicación.

También permite que usuarios sin conocimientos avanzados de SQL puedan construir consultas y reportes mediante una interfaz visual.

## Tecnologías

- ASP.NET Core MVC
- .NET
- SQL Server
- Microsoft.Data.SqlClient
- Bootstrap 5
- JavaScript
- Choices.js
- SweetAlert2
- ClosedXML
- CsvHelper

## Flujo de uso

### Plantillas e importación

1. **Conectar**  
   Ingresar los datos del servidor SQL Server.

2. **Seleccionar base de datos**  
   Elegir la base de datos con la que se desea trabajar.

3. **Seleccionar tabla**  
   Elegir el esquema y tabla correspondiente.

4. **Descargar plantilla**  
   Generar un archivo Excel o CSV con la estructura de la tabla.

5. **Importar datos**  
   Cargar una plantilla previamente llenada y validar su contenido antes de realizar la importación.

### Generación de reportes

1. Seleccionar la base de datos y tabla principal.
2. Seleccionar las columnas que formarán parte del reporte.
3. Agregar relaciones (`JOIN`) con otras tablas si es necesario.
4. Configurar filtros.
5. Agregar métricas o cálculos.
6. Crear columnas condicionales o combinadas.
7. Generar una vista previa del reporte.
8. Exportar el resultado en formato Excel o CSV.
