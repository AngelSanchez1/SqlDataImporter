using SqlDataImporter.Models;
using System.Data;

namespace SqlDataImporter.Services
{
    public interface IImportFileReaderService
    {
        Task<DataTable> ReadAsync(IFormFile file, List<ColumnInfo> columns, List<string> ruleColumns);
    }
}