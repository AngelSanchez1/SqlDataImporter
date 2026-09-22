namespace SqlDataImporter.Models
{
    public class LayoutRequest : ConnectionBase
    {
        public string Database { get; set; } = string.Empty;
        public string Schema { get; set; } = string.Empty;
        public string Table { get; set; } = string.Empty;
        public string Format { get; set; } = string.Empty;
    }
}