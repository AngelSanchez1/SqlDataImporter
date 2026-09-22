namespace SqlDataImporter.Models
{
    public class ImportRequest : ConnectionBase
    {
        public string Database { get; set; } = string.Empty;

        public string Schema { get; set; } = string.Empty;

        public string Table { get; set; } = string.Empty;

        public List<string> RuleColumns { get; set; } = [];

        public IFormFile? File { get; set; }
    }
}