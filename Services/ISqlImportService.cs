using SqlDataImporter.Models;
using System.Data;

namespace SqlDataImporter.Services
{
    public interface ISqlImportService
    {
        Task<ImportExecutionResult> ImportAsync(ImportRequest request, List<ColumnInfo> columns, DataTable data);
    }
}