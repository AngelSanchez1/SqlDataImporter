using SqlDataImporter.Models;

namespace SqlDataImporter.Services
{
    public interface ILayoutService
    {
        byte[] GenerateExcelLayout(List<ColumnInfo> columns, string tableName);

        byte[] GenerateCsvLayout(List<ColumnInfo> columns);
    }
}