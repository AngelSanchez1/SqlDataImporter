(() => {

    let selectedDatabase = null;
    let selectedSchema = null;
    let selectedTable = null;
    let databaseTables = [];
    const tableMetadata = new Map();

    const connectionForm = document.getElementById("connectionForm");
    const reportBuilderSection = document.getElementById("reportBuilderSection");
    const reportColumns = document.getElementById("reportColumns");
    const reportColumnsLoading = document.getElementById("reportColumnsLoading");
    const reportColumnsEmpty = document.getElementById("reportColumnsEmpty");
    const reportDatabase = document.getElementById("reportDatabase");
    const reportTable = document.getElementById("reportTable");
    const selectedColumnsCount = document.getElementById("selectedColumnsCount");
    const selectedColumnsText = document.getElementById("selectedColumnsText");
    const btnSelectAllColumns = document.getElementById("btnSelectAllColumns");
    const btnClearColumns = document.getElementById("btnClearColumns");
    const btnPreviewReport = document.getElementById("btnPreviewReport");
    const btnExportExcel = document.getElementById("btnExportExcel");
    const btnExportCsv = document.getElementById("btnExportCsv");
    const getColumnsUrl = reportBuilderSection.dataset.columnsUrl;
    const reportJoins = document.getElementById("reportJoins");
    const reportJoinsEmpty = document.getElementById("reportJoinsEmpty");
    const btnAddJoin = document.getElementById("btnAddJoin");
    const reportFilters =document.getElementById("reportFilters");
    const reportFiltersEmpty = document.getElementById("reportFiltersEmpty");
    const btnAddFilter = document.getElementById("btnAddFilter");
    const getTablesUrl = reportBuilderSection.dataset.tablesUrl;
    const reportConcatColumns = document.getElementById("reportConcatColumns");
    const reportConcatColumnsEmpty = document.getElementById("reportConcatColumnsEmpty");
    const btnAddConcatColumn = document.getElementById("btnAddConcatColumn");
    const previewUrl = reportBuilderSection.dataset.previewUrl;
    const exportExcelUrl = reportBuilderSection.dataset.exportExcelUrl;
    const exportCsvUrl = reportBuilderSection.dataset.exportCsvUrl;
    const reportPreviewSection = document.getElementById("reportPreviewSection");
    const reportPreviewHead = document.getElementById("reportPreviewHead");
    const reportPreviewBody = document.getElementById("reportPreviewBody");
    const reportPreviewInfo = document.getElementById("reportPreviewInfo");

    document.addEventListener(
        "sqlTargetSelected",
        async function (event) {
            selectedDatabase = event.detail.database;
            selectedSchema = event.detail.schema;
            selectedTable = event.detail.table;
            databaseTables = [];
            tableMetadata.clear();
            reportDatabase.textContent = selectedDatabase;
            reportTable.textContent = `${selectedSchema}.${selectedTable}`;

            reportBuilderSection.classList.remove(
                "d-none"
            );

            limpiarColumnas();
            limpiarJoins();
            limpiarFiltros();
            limpiarColumnasConcatenadas();

            await cargarColumnas();
            await cargarTablasBaseDatos();
        }
    );

    document.addEventListener(
        "sqlTargetCleared",
        function () {

            selectedDatabase = null;
            selectedSchema = null;
            selectedTable = null;
            databaseTables = [];
            tableMetadata.clear();
            reportDatabase.textContent = "";
            reportTable.textContent = "";

            limpiarColumnas();
            limpiarJoins();
            limpiarFiltros();
            limpiarColumnasConcatenadas();

            reportBuilderSection.classList.add(
                "d-none"
            );
        }
    );

    // ==========================================
    // CARGAR COLUMNAS
    // ==========================================
    async function cargarColumnas() {

        reportColumnsLoading.classList.remove(
            "d-none"
        );

        reportColumnsEmpty.classList.add(
            "d-none"
        );

        const formData = new FormData(connectionForm);

        formData.append(
            "Database",
            selectedDatabase
        );

        formData.append(
            "Schema",
            selectedSchema
        );

        formData.append(
            "Table",
            selectedTable
        );


        try {

            const response =
                await fetch(
                    getColumnsUrl,
                    {
                        method: "POST",
                        body: formData
                    }
                );

            const data = await response.json();


            if (!response.ok || !data.success) {
                throw new Error(data.message || `Error HTTP ${response.status}`);
            }

            mostrarColumnas(data.columns);
        }
        catch (error) {
            AppAlert.error("No fue posible obtener las columnas", error.message);
        }
        finally {
            reportColumnsLoading.classList.add(
                "d-none"
            );
        }
    }

    function mostrarColumnas(columns) {

        reportColumns.innerHTML = "";

        if (!columns || columns.length === 0) {
            reportColumnsEmpty.classList.remove("d-none");
            return;
        }

        mostrarGrupoColumnas(selectedSchema, selectedTable, columns, true);
        actualizarEstadoColumnas();
    }

    function mostrarGrupoColumnas(
        schema,
        table,
        columns,
        isMain = false
    ) {

        const existing =
            Array.from(
                reportColumns.querySelectorAll(
                    ".report-column-group"
                )
            )
            .find(
                group =>
                    group.dataset.schema === schema &&
                    group.dataset.table === table
            );

        if (existing) {
            return;
        }

        const group = document.createElement("div");

        group.className = "report-column-group";
        group.dataset.schema = schema;
        group.dataset.table = table;
        group.innerHTML = `
            <div class="report-column-group-title">

                ${schema}.${table}

                ${isMain
                    ? `<span class="badge bg-secondary ms-2">
                           Principal
                       </span>`
                    : `<span class="badge bg-light text-dark border ms-2">
                           Relacionada
                       </span>`
                }

            </div>

            <div class="report-column-group-grid">
            </div>
        `;


        const grid = group.querySelector(".report-column-group-grid");

        columns.forEach(
            column => {

                const item = document.createElement("label");

                item.className = "report-column-item";
                item.innerHTML = `
                    <input
                        type="checkbox"
                        class="form-check-input report-column-checkbox"
                        value="${column.name}"
                        data-schema="${schema}"
                        data-table="${table}"
                        data-column="${column.name}"
                        data-type="${column.dataType}">
                    <div>

                        <div class="report-column-name">
                            ${column.name}
                        </div>
                        <div class="report-column-type">
                            ${obtenerDescripcionTipo(column)}
                        </div>
                    </div>
                `;

                grid.appendChild(item);
            }
        );

        reportColumns.appendChild(group);
    }

    reportColumns.addEventListener(
        "change",
        function (event) {

            if (!event.target.classList.contains("report-column-checkbox")) {
                return;
            }

            const item =
                event.target.closest(
                    ".report-column-item"
                );

            item.classList.toggle(
                "is-selected",
                event.target.checked
            );

            actualizarEstadoColumnas();
        }
    );

    // ==========================================
    // SELECCIONAR TODAS
    // ==========================================
    btnSelectAllColumns.addEventListener(
        "click",
        function () {

            obtenerCheckboxes()
                .forEach(
                    checkbox => {

                        checkbox.checked =
                            true;


                        checkbox.closest(
                            ".report-column-item"
                        )
                        .classList.add(
                            "is-selected"
                        );
                    }
                );

            actualizarEstadoColumnas();
        }
    );

    // ==========================================
    // LIMPIAR
    // ==========================================
    btnClearColumns.addEventListener(
        "click",
        function () {

            obtenerCheckboxes()
                .forEach(
                    checkbox => {
                        checkbox.checked = false;
                        checkbox.closest(
                            ".report-column-item"
                        )
                        .classList.remove(
                            "is-selected"
                        );
                    }
                );

            actualizarEstadoColumnas();
        }
    );

    // ==========================================
    // ESTADO
    // ==========================================
    function actualizarEstadoColumnas() {

        const selected =
            obtenerColumnasSeleccionadas();


        const concatColumns =
            obtenerColumnasConcatenadas();


        const validConcatColumns =
            concatColumns.filter(
                item =>
                    item.columns.length >= 2 &&
                    item.alias.length > 0
            );


        const totalColumns =
            selected.length +
            validConcatColumns.length;


        selectedColumnsCount.textContent =
            totalColumns;


        if (totalColumns === 0) {

            selectedColumnsText.textContent =
                "Seleccione al menos una columna.";

        }
        else {

            const selectedTexts =
                [...selected];


            validConcatColumns.forEach(
                item => {

                    selectedTexts.push(
                        item.alias
                    );

                }
            );


            selectedColumnsText.textContent =
                selectedTexts.join(", ");
        }


        const hasColumns =
            totalColumns > 0;


        btnPreviewReport.disabled =
            !hasColumns;

        btnExportExcel.disabled =
            !hasColumns;

        btnExportCsv.disabled =
            !hasColumns;
    }

    // ==========================================
    // COLUMNAS SELECCIONADAS
    // ==========================================
    function obtenerColumnasSeleccionadas() {

        return obtenerCheckboxes()
            .filter(
                checkbox => checkbox.checked
            )
            .map(
                checkbox => checkbox.value
            );
    }

    function obtenerCheckboxes() {
        return Array.from(reportColumns.querySelectorAll(".report-column-checkbox"));
    }

    // ==========================================
    // LIMPIAR COLUMNAS
    // ==========================================
    function limpiarColumnas() {

        reportColumns.innerHTML = "";
        reportColumnsEmpty.classList.add(
            "d-none"
        );
        selectedColumnsCount.textContent = "0";
        selectedColumnsText.textContent = "Seleccione al menos una columna.";
        btnPreviewReport.disabled = true;
        btnExportExcel.disabled = true;
        btnExportCsv.disabled = true;
    }

    // ==========================================
    // TIPO SQL
    // ==========================================
    function obtenerDescripcionTipo(column) {

        const type = column.dataType.toLowerCase();

        if (type === "varchar" || type === "char") {
            const length = column.maxLength === -1? "MAX" : column.maxLength;
            return `${column.dataType}(${length})`;
        }


        if (type === "nvarchar" || type === "nchar") {
            const length = column.maxLength === -1 ? "MAX" : column.maxLength / 2;
            return `${column.dataType}(${length})`;
        }

        if (type === "decimal" || type === "numeric") {
            return `${column.dataType}(${column.precision},${column.scale})`;
        }

        return column.dataType;
    }

    async function cargarTablasBaseDatos() {

        const formData =new FormData(connectionForm);

        formData.append(
            "Database",
            selectedDatabase
        );


        try {

            const response =
                await fetch(
                    getTablesUrl,
                    {
                        method: "POST",
                        body: formData
                    }
                );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || `Error HTTP ${response.status}`);
            }

            databaseTables = data.tables;
        }
        catch (error) {
            databaseTables =[];
            await AppAlert.error("No fue posible obtener las tablas",error.message);
        }
    }

    async function obtenerColumnasTabla(schema, table) {

        const key = `${schema}.${table}`;

        if (tableMetadata.has(key)) {
            return tableMetadata.get(key);
        }

        const formData = new FormData(connectionForm);

        formData.append(
            "Database",
            selectedDatabase
        );

        formData.append(
            "Schema",
            schema
        );

        formData.append(
            "Table",
            table
        );


        const response =
            await fetch(
                reportBuilderSection.dataset.columnsUrl,
                {
                    method: "POST",
                    body: formData
                }
            );


        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "No fue posible obtener las columnas.");
        }

        tableMetadata.set(key, data.columns);

        return data.columns;
    }

    btnAddJoin.addEventListener(
        "click",
        function () {
            agregarJoin();
        }
    );

    function obtenerOpcionesTablas() {

        const usedTables = new Set(obtenerTablasEnConsulta().map(item => item.fullName.toLowerCase()));

        return databaseTables
            .filter(
                table => {
                    const fullName = `${table.schema}.${table.name}`.toLowerCase();
                    return !usedTables.has(fullName);
                }
            )
            .map(
                table => `
                    <option
                        value="${table.fullName}"
                        data-schema="${table.schema}"
                        data-table="${table.name}">
                        ${table.fullName}
                    </option>
                `
            )
            .join("");
    }

    function refrescarTablasFiltros() {

        const availableTables = obtenerOpcionesTablasConsulta();
        const filters = reportFilters.querySelectorAll(".report-filter-item");

        filters.forEach(
            filter => {

                const select = filter.querySelector(".filter-table");
                const currentValue = select.value;

                select.innerHTML = `
                    <option value="">
                        Seleccione tabla
                    </option>
                    ${availableTables}
                `;

                const optionStillExists =
                    Array.from(select.options)
                    .some(
                        option => option.value === currentValue
                    );

                if (optionStillExists) {
                    select.value = currentValue;
                }
            }
        );
    }

    function obtenerOpcionesColumnasPrincipales() {
        return obtenerCheckboxes()
            .map(
                checkbox => `
                    <option value="${checkbox.dataset.column}">
                        ${checkbox.dataset.column}
                        (${checkbox.dataset.type})
                    </option>
                `
            )
            .join("");
    }

    function agregarJoin() {

        if (databaseTables.length === 0) {
            AppAlert.warning("Sin tablas disponibles", "No se encontraron tablas para agregar.");
            return;
        }

        reportJoinsEmpty.classList.add("d-none");

        const join = document.createElement("div");

        join.className = "report-query-item report-join-item";
        reportJoins.appendChild(join);

        const availableLeftTables = obtenerTablasEnConsulta(join);

        join.innerHTML = `
            <div class="report-query-item-header">

                <div class="report-query-item-title">
                    Relación
                </div>

                <button type="button"
                        class="btn btn-sm btn-outline-danger
                               report-remove-button
                               btn-remove-join">

                    Quitar

                </button>

            </div>


            <div class="report-query-grid">

                <div>

                    <label class="report-field-label">
                        Tipo de relación
                    </label>

                    <select class="form-select join-type">

                        <option value="INNER">
                            INNER JOIN
                        </option>

                        <option value="LEFT">
                            LEFT JOIN
                        </option>

                    </select>

                </div>


                <div>

                    <label class="report-field-label">
                        Tabla origen
                    </label>

                    <select class="form-select join-left-table">

                        <option value="">
                            Seleccione tabla
                        </option>

                        ${availableLeftTables
                            .map(
                                table => `
                                    <option
                                        value="${table.fullName}"
                                        data-schema="${table.schema}"
                                        data-table="${table.table}">

                                        ${table.fullName}

                                    </option>
                                `
                            )
                            .join("")}

                    </select>

                </div>

            </div>


            <div class="report-query-grid mt-3">

                <div>

                    <label class="report-field-label">
                        Columna origen
                    </label>

                    <select class="form-select join-left-column"
                            disabled>

                        <option value="">
                            Seleccione primero una tabla
                        </option>

                    </select>

                </div>


                <div>

                    <label class="report-field-label">
                        Tabla relacionada
                    </label>

                    <select class="form-select join-table">

                        <option value="">
                            Seleccione una tabla
                        </option>

                        ${obtenerOpcionesTablas()}

                    </select>

                </div>

            </div>


            <div class="mt-3">

                <label class="report-field-label">
                    Columna relacionada
                </label>

                <select class="form-select join-right-column"
                        disabled>

                    <option value="">
                        Seleccione primero una tabla
                    </option>

                </select>

            </div>


            <div class="report-join-condition mt-3">
                Configure la relación.
            </div>
        `;
    }

    reportJoins.addEventListener(
        "change",
        async function (event) {

            const join =
                event.target.closest(
                    ".report-join-item"
                );

            if (!join) {
                return;
            }

            if (event.target.classList.contains("join-table")) {

                const option = event.target.selectedOptions[0];
                const schema = option.dataset.schema;
                const table = option.dataset.table;
                const rightColumn = join.querySelector(".join-right-column");

                rightColumn.innerHTML = `
                    <option value="">
                        Cargando...
                    </option>
                `;

                rightColumn.disabled = true;

                if (!schema || !table) {
                    return;
                }


                try {

                    const columns = await obtenerColumnasTabla(schema, table);

                    rightColumn.innerHTML = `
                        <option value="">
                            Seleccione columna
                        </option>

                        ${columns
                            .map(
                                column => `
                                    <option
                                        value="${column.name}">
                                        ${column.name}
                                        (${column.dataType})
                                    </option>
                                `
                            )
                            .join("")}
                    `;


                    rightColumn.disabled = false;

                    mostrarGrupoColumnas(schema, table, columns, false);
                    actualizarEstadoColumnas();
                    actualizarDescripcionJoin(join);
                    refrescarTablasFiltros();
                }
                catch (error) {
                    await AppAlert.error("No fue posible obtener las columnas", error.message);
                }
            }

            if (event.target.classList.contains("join-left-table")) {

                const option = event.target.selectedOptions[0];
                const schema = option?.dataset.schema;
                const table = option?.dataset.table;
                const columnSelect = join.querySelector(".join-left-column");

                columnSelect.innerHTML = `
                    <option value="">
                        Cargando...
                    </option>
                `;

                columnSelect.disabled = true;

                if (!schema || !table) {
                    return;
                }

                try {
                    const columns = await obtenerColumnasTabla(schema,table);

                    columnSelect.innerHTML = `
                        <option value="">
                            Seleccione columna
                        </option>

                        ${columns
                            .map(
                                column => `
                                    <option
                                        value="${column.name}">

                                        ${column.name}
                                        (${column.dataType})

                                    </option>
                                `
                            )
                            .join("")}
                    `;


                    columnSelect.disabled = false;
                    actualizarDescripcionJoin(join);
                }
                catch (error) {
                    await AppAlert.error("No fue posible configurar la relación",error.message);
                }
            }

            if (event.target.classList.contains("join-type") ||
                event.target.classList.contains("join-left-column") ||
                event.target.classList.contains("join-right-column")
            ) {
                actualizarDescripcionJoin(join);
            }
        }
    );

    reportJoins.addEventListener(
        "click",
        function (event) {

            if (!event.target.classList.contains("btn-remove-join")) {
                return;
            }

            event.target
                .closest(
                    ".report-join-item"
                )
                .remove();

            if (reportJoins.children.length === 0) {
                reportJoinsEmpty.classList.remove("d-none");
            }
        }
    );

    btnAddFilter.addEventListener(
        "click",
        function () {
            agregarFiltro();
        }
    );

    function agregarFiltro() {

        reportFiltersEmpty.classList.add(
            "d-none"
        );

        const filter =document.createElement("div");

        filter.className = "report-query-item report-filter-item";

        const isFirst = reportFilters.querySelectorAll(".report-filter-item").length === 0;

        filter.innerHTML = `
            <div class="report-query-item-header">

                <div class="report-query-item-title">
                    Condición
                </div>

                <button type="button"
                        class="btn btn-sm btn-outline-danger
                               btn-remove-filter">

                    Quitar

                </button>

            </div>


            <div class="report-filter-grid">

                <div>

                    <label class="report-field-label">
                        Condición
                    </label>

                    <select class="form-select filter-logical"
                            ${isFirst ? "disabled" : ""}>

                        <option value="AND">
                            AND
                        </option>

                        <option value="OR">
                            OR
                        </option>

                    </select>

                </div>


                <div>

                    <label class="report-field-label">
                        Tabla
                    </label>

                    <select class="form-select filter-table">

                        <option value="">
                            Seleccione tabla
                        </option>

                        ${obtenerOpcionesTablasConsulta()}

                    </select>

                </div>


                <div>

                    <label class="report-field-label">
                        Columna
                    </label>

                    <select class="form-select filter-column"
                            disabled>

                        <option value="">
                            Seleccione primero una tabla
                        </option>

                    </select>

                </div>


                <div>

                    <label class="report-field-label">
                        Operador
                    </label>

                    <select class="form-select filter-operator"
                            disabled>

                        <option value="">
                            Seleccione una columna
                        </option>

                    </select>

                </div>


                <div class="report-filter-value">

                    <label class="report-field-label">
                        Valor
                    </label>

                    <input type="text"
                           class="form-control filter-value"
                           disabled />

                </div>

            </div>
        `;

        reportFilters.appendChild(filter);
        actualizarConectoresFiltros();
    }

    function obtenerOpcionesTablasConsulta() {

        return obtenerTablasEnConsulta()
            .map(
                table => `
                    <option
                        value="${table.fullName}"
                        data-schema="${table.schema}"
                        data-table="${table.table}">
                        ${table.fullName}
                    </option>
                `
            )
            .join("");
    }

    function obtenerOpcionesFiltroTablaPrincipal() {

        return obtenerCheckboxes()
            .map(
                checkbox => `
                    <option
                        value="${checkbox.dataset.column}"
                        data-schema="${selectedSchema}"
                        data-table="${selectedTable}"
                        data-column="${checkbox.dataset.column}"
                        data-type="${checkbox.dataset.type}">

                        ${selectedTable}.${checkbox.dataset.column}

                    </option>
                `
            )
            .join("");
    }

    function obtenerOperadores(sqlType) {
        sqlType = sqlType.toLowerCase();


        if (
            [
                "int",
                "bigint",
                "smallint",
                "tinyint",
                "decimal",
                "numeric",
                "money",
                "smallmoney",
                "float",
                "real"
            ].includes(sqlType)
        ) {

            return [
                ["=", "Igual"],
                ["<>", "Diferente"],
                [">", "Mayor que"],
                [">=", "Mayor o igual"],
                ["<", "Menor que"],
                ["<=", "Menor o igual"],
                ["IN", "Está en"],
                ["NOT_IN", "No está en"]
            ];
        }


        if (
            [
                "date",
                "datetime",
                "datetime2",
                "smalldatetime"
            ].includes(sqlType)
        ) {

            return [
                ["=", "Igual"],
                [">", "Después de"],
                [">=", "Desde"],
                ["<", "Antes de"],
                ["<=", "Hasta"]
            ];
        }

        if (sqlType === "bit") {
            return [
                ["=", "Igual"]
            ];
        }


        return [
            ["=", "Igual"],
            ["<>", "Diferente"],
            ["LIKE", "Contiene"],
            ["STARTS_WITH", "Empieza con"],
            ["ENDS_WITH", "Termina con"],
            ["IN", "Está en"],
            ["NOT_IN", "No está en"],
            ["IS_NULL", "Es nulo"],
            ["IS_NOT_NULL", "No es nulo"]
        ];
    }

    reportFilters.addEventListener(
        "change",
        async function (event) {

            const filter = event.target.closest(".report-filter-item");
            actualizarConectoresFiltros();

            if (!filter) {
                return;
            }

            if (event.target.classList.contains("filter-table")) {

                const option = event.target.selectedOptions[0];
                const schema = option?.dataset.schema;
                const table = option?.dataset.table;

                const columnSelect =
                    filter.querySelector(
                        ".filter-column"
                    );

                const operatorSelect =
                    filter.querySelector(
                        ".filter-operator"
                    );

                const input =
                    filter.querySelector(
                        ".filter-value"
                    );

                columnSelect.disabled = true;
                operatorSelect.disabled = true;
                input.disabled = true;

                columnSelect.innerHTML = `
                    <option value="">
                        Cargando...
                    </option>
                `;

                operatorSelect.innerHTML = `
                    <option value="">
                        Seleccione una columna
                    </option>
                `;

                input.value = "";

                if (!schema || !table) {
                    return;
                }

                try {

                    const columns = await obtenerColumnasTabla(schema,table);

                    columnSelect.innerHTML = `
                        <option value="">
                            Seleccione columna
                        </option>

                        ${columns
                            .map(
                                column => `
                                    <option
                                        value="${column.name}"

                                        data-schema="${schema}"
                                        data-table="${table}"
                                        data-column="${column.name}"
                                        data-type="${column.dataType}">

                                        ${column.name}
                                        (${column.dataType})

                                    </option>
                                `
                            )
                            .join("")}
                    `;

                    columnSelect.disabled = false;
                }
                catch (error) {
                    await AppAlert.error("No fue posible cargar las columnas",error.message);
                }
            }

            if (event.target.classList.contains("filter-column")) {
                const option = event.target.selectedOptions[0];
                const type = option?.dataset.type;
                const operator = filter.querySelector(".filter-operator");
                const input = filter.querySelector(".filter-value");

                if (!type) {
                    operator.disabled = true;
                    input.disabled = true;
                    return;
                }

                const operators = obtenerOperadores(type);

                operator.innerHTML =
                    operators
                        .map(
                            item => `
                                <option value="${item[0]}">
                                    ${item[1]}
                                </option>
                            `
                        )
                        .join("");

                operator.disabled = false;
                input.disabled = false;

                configurarInputFiltro(input, type);
                actualizarValorFiltro(filter);
            }

            if (event.target.classList.contains("filter-operator")) {
                actualizarValorFiltro(filter);
            }
        }
    );

    function configurarInputFiltro(input, type) {
        type = type.toLowerCase();

        if (
            [
                "int",
                "bigint",
                "smallint",
                "tinyint",
                "decimal",
                "numeric",
                "money",
                "float",
                "real"
            ].includes(type)
        ) {

            input.type = "number";
            input.step = "any";
            return;
        }

        if (type === "date") {
            input.type = "date";
            return;
        }

        if (
            [
                "datetime",
                "datetime2",
                "smalldatetime"
            ].includes(type)
        ) {
            input.type = "datetime-local";
            return;
        }

        if (type === "bit") {
            input.type = "number";
            input.min = "0";
            input.max = "1";
            return;
        }

        input.type = "text";
    }

    function actualizarValorFiltro(filter) {
        const operator = filter.querySelector(".filter-operator").value;
        const input = filter.querySelector(".filter-value");
        const columnOption = filter.querySelector(".filter-column").selectedOptions[0];
        const type = columnOption?.dataset.type;
        const noValue = operator === "IS_NULL" || operator === "IS_NOT_NULL";
        const multipleValues = operator === "IN" || operator === "NOT_IN";

        if (noValue) {
            input.disabled = true;
            input.value = "";
            input.placeholder = "";
            return;
        }

        input.disabled = false;

        if (multipleValues) {
            input.type = "text";
            input.removeAttribute("min");
            input.removeAttribute("max");
            input.removeAttribute("step");
            input.placeholder = "Ej. 1, 2, 3";
            return;
        }

        input.placeholder = "";

        if (type) {
            configurarInputFiltro(input, type);
        }
    }

    reportFilters.addEventListener(
        "click",
        function (event) {

            if (!event.target.classList.contains("btn-remove-filter")) {
                return;
            }

            event.target.closest(".report-filter-item").remove();

            if (reportFilters.children.length === 0) {
                reportFiltersEmpty.classList.remove("d-none");
            }
        }
    );

    function limpiarJoins() {
        reportJoins.innerHTML = "";
        reportJoinsEmpty.classList.remove("d-none");
    }

    function limpiarFiltros() {
        reportFilters.innerHTML = "";
        reportFiltersEmpty.classList.remove("d-none");
    }

    btnPreviewReport.addEventListener(
        "click",
        async function () {

            const request = construirReportRequest();

            try {

                AppAlert.loading("Generando vista previa...");

                const response =
                    await fetch(
                        previewUrl,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type":
                                    "application/json"
                            },
                            body: JSON.stringify(request)
                        }
                    );

                const data =await response.json();

                AppAlert.close();

                if (!response.ok || !data.success)
                {
                    throw new Error(data.message || "No fue posible generar la vista previa.");
                }

                mostrarVistaPrevia(data);
            }
            catch (error) {
                AppAlert.close();

                await AppAlert.error("No fue posible generar el reporte", error.message);
            }
        }
    );

    function mostrarVistaPrevia(data) {
        reportPreviewHead.innerHTML = "";
        reportPreviewBody.innerHTML = "";
        reportPreviewHead.innerHTML = `
            <tr>

                ${data.columns
                    .map(
                        column => `
                            <th>
                                ${column}
                            </th>
                        `
                    )
                    .join("")}

            </tr>
        `;

        data.rows.forEach(
            row => {
                const tr = document.createElement("tr");

                data.columns.forEach(
                    column => {
                        const td = document.createElement("td");
                        const value = row[column];

                        td.textContent =
                            value === null ||
                            value === undefined
                                ? ""
                                : value;

                        tr.appendChild(td);
                    }
                );

                reportPreviewBody.appendChild(tr);
            }
        );

        reportPreviewInfo.textContent = `${data.totalRows} registro(s) mostrados. Máximo 100.`;
        reportPreviewSection.classList.remove("d-none");
    }

    btnExportExcel.addEventListener(
        "click",
        async function () {
            await descargarReporte(exportExcelUrl, "Reporte.xlsx");
        }
    );

    btnExportCsv.addEventListener(
        "click",
        async function () {
            await descargarReporte(exportCsvUrl, "Reporte.csv");
        }
    );

    async function descargarReporte(url, defaultFileName) {

        const request = construirReportRequest();

        try {

            AppAlert.loading("Generando archivo...");

            const response =
                await fetch(
                    url,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },
                        body: JSON.stringify(request)
                    }
                );

            if (!response.ok) {

                const error = await response.json();

                throw new Error(error.message || "No fue posible generar el archivo.");
            }

            const blob = await response.blob();
            const contentDisposition = response.headers.get("Content-Disposition");
            let fileName = defaultFileName;

            if (contentDisposition) {

                const match = contentDisposition.match(/filename="?([^"]+)"?/i);

                if (match && match[1]) {
                    fileName = match[1];
                }
            }

            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = downloadUrl;
            link.download = fileName;

            document.body.appendChild(
                link
            );

            link.click();
            link.remove();

            URL.revokeObjectURL(downloadUrl);

            AppAlert.close();
        }
        catch (error) {
            AppAlert.close();

            await AppAlert.error("No fue posible exportar", error.message);
        }
    }

    function construirReportRequest() {
        const connectionData = new FormData(connectionForm);

        return { 
            server: connectionData.get("Server"),
            user: connectionData.get("User"),
            password: connectionData.get("Password"),
            database: selectedDatabase,
            mainSchema: selectedSchema,
            mainTable: selectedTable,
            columns: obtenerColumnasReporte(),
            concatColumns: obtenerColumnasConcatenadas(),
            joins: obtenerJoins(),
            filters: obtenerFiltros(),
            orderBy: []
        };
    }

    function obtenerColumnasReporte() {

        return obtenerCheckboxes()
            .filter(
                x => x.checked
            )
            .map(
            checkbox => ({
                schema: checkbox.dataset.schema,
                table: checkbox.dataset.table,
                column: checkbox.dataset.column,
                alias: null
            })
        );
    }

    function obtenerJoins() {

        return Array
            .from(reportJoins.querySelectorAll(".report-join-item"))
            .map(
                join => {

                    const leftTable = join.querySelector(".join-left-table").selectedOptions[0];
                    const rightTable = join.querySelector(".join-table").selectedOptions[0];

                    return {
                        joinType: join.querySelector(".join-type").value,
                        leftSchema: leftTable?.dataset.schema ?? "",
                        leftTable: leftTable?.dataset.table ?? "",
                        leftColumn: join.querySelector(".join-left-column").value,
                        rightSchema: rightTable?.dataset.schema ?? "",
                        rightTable: rightTable?.dataset.table ?? "",
                        rightColumn: join.querySelector(".join-right-column").value
                    };
                }
            );
    }

    function obtenerFiltros() {

        return Array
            .from(
                reportFilters.querySelectorAll(
                    ".report-filter-item"
                )
            )
            .map(
                filter => {
                    const column = filter.querySelector(".filter-column").selectedOptions[0];
                    const operator = filter.querySelector(".filter-operator").value;
                    const value = filter.querySelector(".filter-value").value;
                    const isMultiple = operator === "IN" || operator === "NOT_IN";

                    return {
                        logicalOperator: filter.querySelector(".filter-logical").value,
                        schema: column?.dataset.schema ?? "",
                        table: column?.dataset.table ?? "",
                        column: column?.dataset.column ?? "",
                        operator: operator,
                        value: isMultiple ? null : value,
                        valueTo: null,
                        values:
                            isMultiple
                                ? value
                                    .split(",")
                                    .map(x => x.trim())
                                    .filter(x => x.length > 0)
                                : []
                    };
                }
            );
    }

    function actualizarDescripcionJoin(join) {
        const joinType = join.querySelector(".join-type").value;
        const leftTableOption = join.querySelector(".join-left-table").selectedOptions[0];
        const rightTableOption = join.querySelector(".join-table").selectedOptions[0];
        const leftColumn = join.querySelector(".join-left-column").value;
        const rightColumn = join.querySelector(".join-right-column").value;
        const description = join.querySelector(".report-join-condition");
        const leftSchema = leftTableOption?.dataset.schema;
        const leftTable = leftTableOption?.dataset.table;
        const rightSchema = rightTableOption?.dataset.schema;
        const rightTable = rightTableOption?.dataset.table;

        if (!leftSchema || !leftTable || !rightSchema || !rightTable || !leftColumn || !rightColumn) {
            description.textContent = "Configure la relación.";
            return;
        }

        description.textContent =
            `${joinType} JOIN `
            + `${rightSchema}.${rightTable} `
            + `ON `
            + `${leftSchema}.${leftTable}.${leftColumn} `
            + `= `
            + `${rightSchema}.${rightTable}.${rightColumn}`;
    }

    function obtenerTablasEnConsulta(hastaJoin = null) {

        const tables = [
            {
                schema: selectedSchema,
                table: selectedTable,
                fullName: `${selectedSchema}.${selectedTable}`
            }
        ];

        const joins = Array.from(reportJoins.querySelectorAll(".report-join-item"));

        for (const join of joins) {

            if (hastaJoin && join === hastaJoin) {
                break;
            }

            const option = join.querySelector(".join-table")?.selectedOptions[0];
            const schema = option?.dataset.schema;
            const table = option?.dataset.table;

            if (!schema || !table) {
                continue;
            }

            const exists =
                tables.some(
                    item =>
                        item.schema === schema &&
                        item.table === table
                );


            if (!exists) {

                tables.push({
                    schema,
                    table,
                    fullName: `${schema}.${table}`
                });
            }
        }

        return tables;
    }

    function actualizarConectoresFiltros() {
        const filters = Array.from(reportFilters.querySelectorAll(".report-filter-item"));


        filters.forEach(
            (filter, index) => {
                const logical = filter.querySelector(".filter-logical");

                if (index === 0) {
                    logical.value = "AND";
                    logical.disabled = true;
                }
                else {
                    logical.disabled = false;
                }
            }
        );
    }

    btnAddConcatColumn.addEventListener(
        "click",
        function () {
            agregarColumnaConcatenada();
        }
    );

    function obtenerColumnasDisponiblesReporte() {

        return obtenerCheckboxes()
            .map(
                checkbox => ({
                    schema: checkbox.dataset.schema,
                    table: checkbox.dataset.table,
                    column: checkbox.dataset.column,
                    type: checkbox.dataset.type
                })
            );
    }

    function esTipoConcatenable(type) {
        return [
            "varchar",
            "nvarchar",
            "char",
            "nchar",
            "text",
            "ntext"
        ].includes(
            type.toLowerCase()
        );
    }

    function agregarColumnaConcatenada() {

        const availableColumns =
            obtenerColumnasDisponiblesReporte()
                .filter(
                    column => esTipoConcatenable(column.type)
                );


        if (availableColumns.length < 2) {

            AppAlert.warning(
                "Columnas insuficientes",
                "Debe haber al menos dos columnas de texto disponibles para realizar una concatenación."
            );

            return;
        }

        reportConcatColumnsEmpty.classList.add("d-none");

        const item = document.createElement("div");

        item.className = "report-query-item report-concat-item";
        item.innerHTML = `
            <div class="report-query-item-header">

                <div class="report-query-item-title">
                    Columna combinada
                </div>

                <button type="button"
                        class="btn btn-sm btn-outline-danger btn-remove-concat">

                    Quitar

                </button>

            </div>


            <div class="mb-3">

                <label class="report-field-label">
                    Columnas
                </label>

                <div class="report-concat-columns">

                    ${availableColumns
                        .map(
                            column => `
                                <label class="form-check mb-2">

                                    <input
                                        type="checkbox"
                                        class="form-check-input concat-column"
                                        data-schema="${column.schema}"
                                        data-table="${column.table}"
                                        data-column="${column.column}"
                                        data-type="${column.type}">

                                    <span class="form-check-label">
                                        ${column.schema}.${column.table}.${column.column}
                                    </span>

                                </label>
                            `
                        )
                        .join("")}

                </div>

            </div>


            <div class="report-query-grid">

                <div>

                    <label class="report-field-label">
                        Separador
                    </label>

                    <select class="form-select concat-separator">

                        <option value=" ">
                            Espacio
                        </option>

                        <option value=", ">
                            Coma + espacio
                        </option>

                        <option value=" - ">
                            Guion
                        </option>

                        <option value="">
                            Sin separador
                        </option>

                    </select>

                </div>


                <div>

                    <label class="report-field-label">
                        Alias
                    </label>

                    <input type="text"
                           class="form-control concat-alias"
                           placeholder="Ej. NombreCompleto" />

                </div>

            </div>
        `;

        reportConcatColumns.appendChild(item);

        actualizarEstadoColumnas();
    }

    reportConcatColumns.addEventListener(
        "change",
        actualizarEstadoColumnas
    );

    reportConcatColumns.addEventListener(
        "input",
        actualizarEstadoColumnas
    );

    reportConcatColumns.addEventListener(
        "click",
        function (event) {

            const button =
                event.target.closest(
                    ".btn-remove-concat"
                );

            if (!button) {
                return;
            }

            const item =
                button.closest(
                    ".report-concat-item"
                );

            if (!item) {
                return;
            }

            item.remove();


            if (
                reportConcatColumns.children.length === 0
            ) {

                reportConcatColumnsEmpty.classList.remove(
                    "d-none"
                );
            }


            actualizarEstadoColumnas();
        }
    );


    function obtenerColumnasConcatenadas() {
        return Array
            .from(
                reportConcatColumns.querySelectorAll(
                    ".report-concat-item"
                )
            )
            .map(
                item => {

                    const columns =
                        Array
                            .from(
                                item.querySelectorAll(
                                    ".concat-column:checked"
                                )
                            )
                            .map(
                                checkbox => ({
                                    schema:
                                        checkbox.dataset.schema,

                                    table:
                                        checkbox.dataset.table,

                                    column:
                                        checkbox.dataset.column
                                })
                            );


                    return {
                        columns: columns,

                        separator:
                            item.querySelector(
                                ".concat-separator"
                            ).value,

                        alias:
                            item.querySelector(
                                ".concat-alias"
                            ).value.trim()
                    };
                }
            );
    }

    function limpiarColumnasConcatenadas() {
        reportConcatColumns.innerHTML = "";
        reportConcatColumnsEmpty.classList.remove("d-none");
    }
})();