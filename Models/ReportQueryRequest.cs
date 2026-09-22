namespace SqlDataImporter.Models
{
    public class ReportQueryRequest : ConnectionBase
    {
        public string Database { get; set; } = string.Empty;
        public string MainSchema { get; set; } = string.Empty;
        public string MainTable { get; set; } = string.Empty;
        public List<ReportColumn> Columns { get; set; } = new();
        public List<ReportConcatColumn> ConcatColumns { get; set; } = new();
        public List<ReportJoin> Joins { get; set; } = new();
        public List<ReportFilter> Filters { get; set; } = new();
        public List<ReportOrder> OrderBy { get; set; } = new();
        public string NombreReporte { get; set; } = string.Empty;
        public List<ReportConditionalColumn> ConditionalColumns { get; set; } = new();
        public List<ReportMetric> Metrics { get; set; } = new();
        public List<ReportColumnReference> GroupBy { get; set; } = new();
        public List<ReportFilter> Having { get; set; } = new();
        public List<ReportParameter> Parameters { get; set; } = new();
    }

    public class ReportColumn : DataBaseDto
    {
        public string? Alias { get; set; }
    }

    public class ReportJoin
    {
        public string JoinType { get; set; } = "INNER";
        public string LeftSchema { get; set; } = string.Empty;
        public string LeftTable { get; set; } = string.Empty;
        public string LeftColumn { get; set; } = string.Empty;
        public string RightSchema { get; set; } = string.Empty;
        public string RightTable { get; set; } = string.Empty;
        public string RightColumn { get; set; } = string.Empty;
    }

    public class ReportFilter : DataBaseDto
    {
        public string LogicalOperator { get; set; } = "AND";
        public string Operator { get; set; } = "=";
        public string? Value { get; set; }
        public string? ValueTo { get; set; }
        public List<string> Values { get; set; } = new();
    }

    public class ReportOrder : DataBaseDto
    {
        public string Direction { get; set; } = "ASC";
    }

    public class ReportConcatColumn
    {
        public List<ReportColumnReference> Columns { get; set; } = new();
        public string Separator { get; set; } = " ";
        public string Alias { get; set; } = string.Empty;
    }

    public class ReportColumnReference : DataBaseDto
    {

    }

    public class ReportMetric : DataBaseDto
    {
        public string Function { get; set; } = "SUM";
        public string Alias { get; set; } = string.Empty;
        public bool Distinct { get; set; }
        public bool NullAsZero { get; set; } = true;
        public List<ReportMetricCondition> Conditions { get; set; } = new();
        public string? ArithmeticOperator { get; set; }
        public decimal? ArithmeticValue { get; set; }
    }

    public class ReportMetricCondition : DataBaseDto
    {
        public string LogicalOperator { get; set; } = "AND";
        public string Operator { get; set; } = "=";
        public string? Value { get; set; }
        public List<string> Values { get; set; } = new();
    }

    public class ReportParameter
    {
        public string Name { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public string DataType { get; set; } = "string";
        public string? Value { get; set; }
    }

    public class ReportConditionalColumn
    {
        public string Alias { get; set; } = string.Empty;

        public List<ReportCaseWhen> Cases { get; set; } = new();

        public ReportCaseResult ElseResult { get; set; } = new();
    }

    public class ReportCaseWhen
    {
        public List<ReportMetricCondition> Conditions { get; set; } = new();

        public ReportCaseResult Result { get; set; } = new();
    }

    public class ReportCaseResult : DataBaseDto
    {
        public string ResultType { get; set; } = "VALUE";
        public string? Value { get; set; }
        public string ValueType { get; set; } = "string";
    }
}