using System.Data;
using SqlDataImporter.Models;

namespace SqlDataImporter.Services
{
    public interface IReportExecutionService
    {
        Task<DataTable> ExecuteAsync(ReportQueryRequest request, bool preview);
    }
}