namespace SqlDataImporter.Models
{
    public class ReportColumnMetadata : DataBaseDto
    {
        public string DataType { get; set; } = string.Empty;
        public byte Precision { get; set; }
        public byte Scale { get; set; }
    }
}