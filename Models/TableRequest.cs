namespace SqlDataImporter.Models
{
    public class TableRequest : ConnectionBase
    {
        public string Database { get; set; } = string.Empty;

        public string Schema { get; set; } = string.Empty;

        public string Table { get; set; } = string.Empty;
    }
}