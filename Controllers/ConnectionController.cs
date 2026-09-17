using Microsoft.AspNetCore.Mvc;
using SqlDataImporter.Models;
using SqlDataImporter.Services;

namespace SqlDataImporter.Controllers
{
    public class ConnectionController : Controller
    {
        private readonly ISqlConnectionService _connectionService;
        private readonly IDatabaseMetadataService _databaseMetadataService;

        public ConnectionController(
            ISqlConnectionService connectionService,
            IDatabaseMetadataService databaseMetadataService)
        {
            _connectionService = connectionService;
            _databaseMetadataService = databaseMetadataService;
        }

        [HttpPost]
        public async Task<IActionResult> TestConnection(ConnectionRequest request)
        {
            try
            {
                var connected =
                    await _connectionService.TestConnectionAsync(request.Server, request.User, request.Password);

                if (!connected)
                {
                    return Json(new
                    {
                        success = false,
                        message = "No fue posible establecer la conexión."
                    });
                }

                var databases = await _databaseMetadataService.GetDatabasesAsync(request.Server, request.User, request.Password);

                return Json(new
                {
                    success = true,
                    message = "Conexión realizada correctamente.",
                    databases
                });
            }
            catch (Exception ex)
            {
                return Json(new
                {
                    success = false,
                    message = ex.Message
                });
            }
        }

        [HttpPost]
        public async Task<IActionResult> GetTables(DatabaseRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.Database))
                {
                    return Json(new
                    {
                        success = false,
                        message = "Debe seleccionar una base de datos."
                    });
                }

                var tables =
                    await _databaseMetadataService.GetTablesAsync(
                        request.Server,
                        request.User,
                        request.Password,
                        request.Database);

                return Json(new
                {
                    success = true,
                    tables
                });
            }
            catch (Exception ex)
            {
                return Json(new
                {
                    success = false,
                    message = ex.Message
                });
            }
        }

        [HttpPost]
        public async Task<IActionResult> GetColumns(TableRequest request)
        {
            try
            {
                var columns =
                    await _databaseMetadataService.GetColumnsAsync(
                        request.Server,
                        request.User,
                        request.Password,
                        request.Database,
                        request.Schema,
                        request.Table);

                return Json(new
                {
                    success = true,
                    columns
                });
            }
            catch (Exception ex)
            {
                return Json(new
                {
                    success = false,
                    message = ex.Message
                });
            }
        }
    }
}