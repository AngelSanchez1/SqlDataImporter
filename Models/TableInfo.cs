namespace SqlDataImporter.Models
{
    public class TableInfo
    {
        public string Schema { get; set; } = string.Empty;

        public string Name { get; set; } = string.Empty;

        public string FullName => $"{Schema}.{Name}";
    }
}
