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
    const joinsCountBadge = document.getElementById("joinsCountBadge");
    const filtersCountBadge = document.getElementById("filtersCountBadge");
    const concatCountBadge = document.getElementById("concatCountBadge");
    const reportNameInput = document.getElementById("reportName");
    const reportMetrics = document.getElementById("reportMetrics");
    const reportMetricsEmpty = document.getElementById("reportMetricsEmpty");
    const btnAddMetric = document.getElementById("btnAddMetric");
    const metricsCountBadge = document.getElementById("metricsCountBadge");
    const reportConditionalColumns = document.getElementById("reportConditionalColumns");
    const reportConditionalColumnsEmpty = document.getElementById("reportConditionalColumnsEmpty");
    const btnAddConditionalColumn = document.getElementById("btnAddConditionalColumn");
    const conditionalColumnsCountBadge = document.getElementById("conditionalColumnsCountBadge");
    const MAIN_SOURCE_ID = "main";
    let outputOrderSequence = 0;
    let sourceSequence = 0;

    function obtenerSiguienteSourceId() {
        sourceSequence++;
        return `src_${sourceSequence}`;
    }

    function activarSelectBuscable(select) {
        if (!select) {
            return;
        }

        if (select._choicesInstance) {
            return;
        }

        const isDisabled = select.disabled;

        select._choicesInstance =
            new Choices(
                select,
                {
                    searchEnabled: true,
                    searchFloor: 0,
                    shouldSort: false,
                    itemSelectText: "",
                    noResultsText: "No se encontraron resultados",
                    noChoicesText: "No hay opciones disponibles",
                    searchPlaceholderValue: "Buscar...",
                    placeholder: true,
                    allowHTML: false
                }
            );

        if (isDisabled) {
            select._choicesInstance.disable();
        }
    }

    function destruirSelectBuscable(select) {
        if (select && select._choicesInstance) {
            select._choicesInstance.destroy();
            select._choicesInstance = null;
        }
    }

    function actualizarSelectBuscable(select, html, value = "", disabled = false) {
        destruirSelectBuscable(select);
        select.innerHTML = html;

        if (value) {
            select.value = value;
        }

        select.disabled = disabled;
        activarSelectBuscable(select);

        if (disabled) {
            select._choicesInstance.disable();
        }
        else {
            select._choicesInstance.enable();
        }
    }

    function destruirSelectsBuscablesDentro(container) {
        if (!container) {
            return;
        }

        container
            .querySelectorAll("select")
            .forEach(
                select => {
                    destruirSelectBuscable(select);
                }
            );
    }

    document.addEventListener(
        "sqlTargetSelected",
        async function (event) {
            outputOrderSequence = 0;
            sourceSequence = 0;
            selectedDatabase = event.detail.database;
            selectedSchema = event.detail.schema;
            selectedTable = event.detail.table;
            databaseTables = [];
            tableMetadata.clear();
            reportDatabase.textContent = selectedDatabase;
            reportTable.textContent = `${selectedSchema}.${selectedTable}`;
            reportBuilderSection.classList.remove("d-none");
            limpiarColumnas();
            limpiarJoins();
            limpiarFiltros();
            limpiarMetricas();
            limpiarColumnasCondicionales();
            limpiarColumnasConcatenadas();
            await cargarColumnas();
            await cargarTablasBaseDatos();
        }
    );

    document.addEventListener(
        "sqlTargetCleared",
        function () {
            outputOrderSequence = 0;
            sourceSequence = 0;
            selectedDatabase = null;
            selectedSchema = null;
            selectedTable = null;
            databaseTables = [];
            tableMetadata.clear();
            reportDatabase.textContent = "";
            reportTable.textContent = "";
            reportNameInput.value = "";
            limpiarColumnas();
            limpiarJoins();
            limpiarFiltros();
            limpiarMetricas();
            limpiarColumnasCondicionales();
            limpiarColumnasConcatenadas();
            reportBuilderSection.classList.add("d-none");
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

        mostrarGrupoColumnas(
            MAIN_SOURCE_ID,
            selectedSchema,
            selectedTable,
            columns,
            true,
            "Principal"
        );

        actualizarEstadoColumnas();
    }

    function mostrarGrupoColumnas(
        sourceId,
        schema,
        table,
        columns,
        isMain = false,
        sourceAlias = ""
    ) {

        const existing =
            Array
                .from(
                    reportColumns.querySelectorAll(
                        ".report-column-group"
                    )
                )
                .find(
                    group =>
                        group.dataset.sourceId ===
                        sourceId
                );

        if (existing) {
            const sameTable = existing.dataset.schema === schema && existing.dataset.table === table;

            if (sameTable) {
                const title = existing.querySelector(".report-column-group-title");

                const displayName =
                    isMain
                        ? `${schema}.${table}`
                        : sourceAlias
                            ? `${sourceAlias} — ${schema}.${table}`
                            : `${schema}.${table}`;

                title.innerHTML = `
                    ${displayName}

                    ${
                        isMain
                            ? `
                                <span class="badge bg-secondary ms-2">
                                    Principal
                                </span>
                            `
                            : `
                                <span class="badge bg-light text-dark border ms-2">
                                    Relacionada
                                </span>
                            `
                    }
                `;

                return;
            }

            existing.remove();
        }

        const group = document.createElement("div");

        group.className = "report-column-group";
        group.dataset.sourceId = sourceId;
        group.dataset.schema = schema;
        group.dataset.table = table;

        const displayName =
            isMain
                ? `${schema}.${table}`
                : sourceAlias
                    ? `${sourceAlias} — ${schema}.${table}`
                    : `${schema}.${table}`;

        group.innerHTML = `
            <div class="report-column-group-title">

                ${displayName}

                ${
                    isMain
                        ? `
                            <span class="badge bg-secondary ms-2">
                                Principal
                            </span>
                        `
                        : `
                            <span class="badge bg-light text-dark border ms-2">
                                Relacionada
                            </span>
                        `
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
                        data-source-id="${sourceId}"
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

                        <div class="report-column-alias-wrapper d-none mt-2">

                            <input
                                type="text"
                                class="form-control form-control-sm report-column-alias"
                                placeholder="Alias opcional" />

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

            const checkbox = event.target;
            const item =checkbox.closest(".report-column-item");


            if (checkbox.checked) {
                if (!checkbox.dataset.outputOrder) {
                    checkbox.dataset.outputOrder = obtenerSiguienteOrdenSalida();
                }
            }
            else {

                delete checkbox.dataset.outputOrder;
            }

            item.classList.toggle("is-selected", event.target.checked);

            item
            .querySelector(
                ".report-column-alias-wrapper"
            )
            .classList.toggle(
                "d-none",
                !checkbox.checked
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

                        if (!checkbox.checked) {
                            checkbox.dataset.outputOrder = obtenerSiguienteOrdenSalida();
                        }

                        checkbox.checked = true;
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
                        delete checkbox.dataset.outputOrder;
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
        const outputColumns = obtenerColumnasSalidaOrdenadas();
        selectedColumnsCount.textContent = outputColumns.length;

        if (outputColumns.length === 0) {
            selectedColumnsText.textContent = "Seleccione al menos una columna.";
        }
        else {
            selectedColumnsText.textContent = outputColumns.map(item => item.name).join(", ");
        }

        const hasColumns = outputColumns.length > 0;
        btnPreviewReport.disabled = !hasColumns;
        btnExportExcel.disabled = !hasColumns;
        btnExportCsv.disabled = !hasColumns;
    }

    function obtenerColumnasSalidaOrdenadas() {
        const result = [];

        obtenerCheckboxes()
            .filter(checkbox => checkbox.checked)
            .forEach(
                checkbox => {
                    const alias = obtenerAliasColumna(checkbox);
                    result.push({
                        order: Number(checkbox.dataset.outputOrder) || 0,
                        name: alias || checkbox.dataset.column
                    });
                }
            );

        obtenerColumnasConcatenadas()
            .filter(item => item.columns.length >= 2 && item.alias)
            .forEach(
                item => {
                    result.push({
                        order: item.order,
                        name: item.alias
                    });
                }
            );

        obtenerColumnasCondicionales()
            .filter(item => item.alias && item.cases.length > 0)
            .forEach(
                item => {
                    result.push({
                        order: item.order,
                        name: item.alias
                    });
                }
            );

        obtenerMetricas()
            .filter(metric => metric.alias && (metric.column || metric.function === "COUNT"))
            .forEach(
                metric => {
                    result.push({
                        order: metric.order,
                        name: metric.alias
                    });
                }
            );

        return result
            .sort(
                (a, b) => {
                    const orderA = a.order <= 0 ? Number.MAX_SAFE_INTEGER : a.order;
                    const orderB = b.order <= 0 ? Number.MAX_SAFE_INTEGER : b.order;
                    return orderA - orderB;
                }
            );
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
        return databaseTables
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
        join.dataset.sourceId = obtenerSiguienteSourceId();
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
                                source => `
                                    <option
                                        value="${source.sourceId}"
                                        data-source-id="${source.sourceId}"
                                        data-schema="${source.schema}"
                                        data-table="${source.table}">
                                        ${source.label}
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

                    <select class="form-select join-left-column" disabled>

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

                <div class="mt-3">

                    <label class="report-field-label">
                        Nombre de la relación
                    </label>

                    <input
                        type="text"
                        class="form-control join-source-alias"
                        placeholder="Ej. Usuario Alta" />

                    <div class="form-text">
                        Permite identificar esta instancia de la tabla
                        en filtros, métricas y columnas calculadas.
                    </div>

                </div>

            </div>

            <div class="mt-3">

                <label class="report-field-label">
                    Columna relacionada
                </label>

                <select class="form-select join-right-column" disabled>

                    <option value="">
                        Seleccione primero una tabla
                    </option>

                </select>

            </div>

            <div class="report-join-condition mt-3">
                Configure la relación.
            </div>
        `;

        actualizarBadge(joinsCountBadge, reportJoins.children.length);
        activarSelectBuscable(join.querySelector(".join-left-table"));
        activarSelectBuscable(join.querySelector(".join-table"));
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

                actualizarSelectBuscable(
                    rightColumn,
                    `
                        <option value="">
                            Cargando...
                        </option>
                    `,
                    "",
                    true
                );

                rightColumn.disabled = true;

                if (!schema || !table) {
                    return;
                }


                try {

                    const columns = await obtenerColumnasTabla(schema, table);

                    actualizarSelectBuscable(
                        rightColumn,
                        `
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
                        `,
                        "",
                        false
                    );

                    const sourceAlias = join.querySelector(".join-source-alias")?.value?.trim();

                    mostrarGrupoColumnas(join.dataset.sourceId, schema, table, columns, false, sourceAlias);
                    actualizarEstadoColumnas();
                    actualizarDescripcionJoin(join);
                    refrescarFuentesOrigenJoins();
                    refrescarFuentesConsulta();
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

                actualizarSelectBuscable(
                    columnSelect,
                    `
                        <option value="">
                            Cargando...
                        </option>
                    `,
                    "",
                    true
                );

                if (!schema || !table) {
                    actualizarSelectBuscable(
                        columnSelect,
                        `
                            <option value="">
                                Seleccione primero una tabla
                            </option>
                        `,
                        "",
                        true
                    );
                    return;
                }

                try {
                    const columns = await obtenerColumnasTabla(schema,table);

                    actualizarSelectBuscable(
                        columnSelect,
                        `
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
                        `,
                        "",
                        false
                    );
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

            const join =
                event.target.closest(
                    ".report-join-item"
                );

            const sourceId = join.dataset.sourceId;
            const dependentJoin =
                Array
                    .from(
                        reportJoins.querySelectorAll(
                            ".report-join-item"
                        )
                    )
                    .find(
                        item =>
                            item !== join &&
                            item.querySelector(
                                ".join-left-table"
                            )?.value === sourceId
                    );

            if (dependentJoin) {

                AppAlert.warning(
                    "Relación en uso",
                    "Esta relación está siendo utilizada como origen de otra relación. Quite primero las relaciones que dependen de ella."
                );

                return;
            }

            destruirSelectsBuscablesDentro(join);

            join.remove();

            const columnGroup =
                reportColumns.querySelector(
                    `.report-column-group[data-source-id="${sourceId}"]`
                );

            if (columnGroup) {
                columnGroup.remove();
            }

            actualizarEstadoColumnas();
            refrescarFuentesOrigenJoins();
            refrescarFuentesConsulta();

            if (reportJoins.children.length === 0) {
                reportJoinsEmpty.classList.remove("d-none");
            }

            actualizarBadge(joinsCountBadge, reportJoins.children.length);
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

        const filter = document.createElement("div");
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
        actualizarBadge(filtersCountBadge, reportFilters.children.length);
        activarSelectBuscable(filter.querySelector(".filter-table")
);
    }

    function obtenerOpcionesTablasConsulta() {

        return obtenerTablasEnConsulta()
            .map(
                source => `
                    <option
                        value="${source.sourceId}"
                        data-source-id="${source.sourceId}"
                        data-schema="${source.schema}"
                        data-table="${source.table}">
                        ${source.label}
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
                [">=", "Mayor igual que"],
                ["<", "Antes de"],
                ["<=", "Menor igual que"]
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
                const columnSelect = filter.querySelector(".filter-column");
                const operatorSelect = filter.querySelector(".filter-operator");
                const input = filter.querySelector(".filter-value");
                const sourceId = option?.dataset.sourceId;

                columnSelect.disabled = true;
                operatorSelect.disabled = true;
                input.disabled = true;

                operatorSelect.innerHTML = `
                    <option value="">
                        Seleccione una columna
                    </option>
                `;

                input.value = "";

                actualizarSelectBuscable(
                    columnSelect,
                    `
                        <option value="">
                            Cargando...
                        </option>
                    `,
                    "",
                    true
                );

                if (!schema || !table) {
                    actualizarSelectBuscable(
                        columnSelect,
                        `
                            <option value="">
                                Seleccione primero una tabla
                            </option>
                        `,
                        "",
                        true
                    );
                    return;
                }

                try {

                    const columns = await obtenerColumnasTabla(schema,table);

                    actualizarSelectBuscable(
                        columnSelect,
                        `
                            <option value="">
                                Seleccione columna
                            </option>

                            ${columns
                                .map(
                                    column => `
                                        <option
                                            value="${column.name}"
                                            data-source-id="${sourceId}"
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
                        `,
                        "",
                        false
                    );
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

            actualizarBadge(filtersCountBadge, reportFilters.children.length);
        }
    );

    function limpiarJoins() {
        destruirSelectsBuscablesDentro(reportJoins);
        reportJoins.innerHTML = "";
        reportJoinsEmpty.classList.remove("d-none");
        actualizarBadge(joinsCountBadge, 0);
    }

    function limpiarFiltros() {
        destruirSelectsBuscablesDentro(reportFilters);
        reportFilters.innerHTML = "";
        reportFiltersEmpty.classList.remove("d-none");
        actualizarBadge(filtersCountBadge, 0);
    }

    btnPreviewReport.addEventListener(
        "click",
        async function () {

            const request = construirReportRequest();
            const validation = validarConfiguracionReporte(request);

            if (!validation.valid) {
                await AppAlert.warning("Configuración incompleta", validation.message);
                return;
            }

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
            await descargarReporte(exportExcelUrl, `${obtenerNombreReporte()}.xlsx`);
        }
    );

    btnExportCsv.addEventListener(
        "click",
        async function () {
            await descargarReporte(exportCsvUrl,  `${obtenerNombreReporte()}.csv`);
        }
    );

    async function descargarReporte(url, defaultFileName) {

        const request = construirReportRequest();
        const validation = validarConfiguracionReporte(request);

        if (!validation.valid) {
            await AppAlert.warning("Configuración incompleta", validation.message);
            return;
        }

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
            mainSourceId: MAIN_SOURCE_ID,
            mainSchema: selectedSchema,
            mainTable: selectedTable,
            columns: obtenerColumnasReporte(),
            concatColumns: obtenerColumnasConcatenadas(),
            conditionalColumns: obtenerColumnasCondicionales(),
            metrics: obtenerMetricas(),
            joins: obtenerJoins(),
            filters: obtenerFiltros(),
            groupBy: [],
            having: [],
            parameters: [],
            orderBy: [],
            nombreReporte: obtenerNombreReporte()
        };
    }

    function obtenerColumnasReporte() {

        return obtenerCheckboxes()
            .filter(
                x => x.checked
            )
            .map(
            checkbox => ({
                sourceId: checkbox.dataset.sourceId,
                schema: checkbox.dataset.schema,
                table: checkbox.dataset.table,
                column: checkbox.dataset.column,
                alias: obtenerAliasColumna(checkbox),
                order: Number(checkbox.dataset.outputOrder) || 0
            })
        );
    }

    function obtenerJoins() {
        return Array
            .from(
                reportJoins.querySelectorAll(
                    ".report-join-item"
                )
            )
            .map(
                join => {

                    const leftSource =
                        join.querySelector(
                            ".join-left-table"
                        )
                        .selectedOptions[0];


                    const rightTable =
                        join.querySelector(
                            ".join-table"
                        )
                        .selectedOptions[0];


                    return {
                        joinType:
                            join.querySelector(
                                ".join-type"
                            ).value,

                        leftSourceId:
                            leftSource?.dataset.sourceId ??
                            "",

                        leftSchema:
                            leftSource?.dataset.schema ??
                            "",

                        leftTable:
                            leftSource?.dataset.table ??
                            "",

                        leftColumn:
                            join.querySelector(
                                ".join-left-column"
                            ).value,

                        rightSourceId:
                            join.dataset.sourceId,

                        rightSchema:
                            rightTable?.dataset.schema ??
                            "",

                        rightTable:
                            rightTable?.dataset.table ??
                            "",

                        rightColumn:
                            join.querySelector(
                                ".join-right-column"
                            ).value,

                        alias:
                            join.querySelector(
                                ".join-source-alias"
                            )
                            ?.value
                            ?.trim() ??
                            ""
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
                        sourceId: column?.dataset.sourceId ??"",
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
                                    .map(
                                        x => x.trim().replace(/^['"]|['"]$/g, "")
                                    )
                                    .filter(
                                        x => x.length > 0
                                    )
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

        const sourceAlias =join.querySelector(".join-source-alias")?.value?.trim();
        description.textContent =
            `${joinType} JOIN `
            +
            `${rightSchema}.${rightTable}`
            +
            (
                sourceAlias
                    ? ` (${sourceAlias})`
                    : ""
            )
            +
            ` ON `
            +
            `${leftSchema}.${leftTable}.${leftColumn} `
            +
            `= `
            +
            `${rightSchema}.${rightTable}.${rightColumn}`;
    }

    function obtenerTablasEnConsulta(hastaJoin = null) {
        const sources = [
            {
                sourceId: MAIN_SOURCE_ID,
                schema: selectedSchema,
                table: selectedTable,
                fullName: `${selectedSchema}.${selectedTable}`,
                alias: "Principal",
                label: `${selectedSchema}.${selectedTable} (Principal)`
            }
        ];

        const joins =
            Array.from(
                reportJoins.querySelectorAll(
                    ".report-join-item"
                )
            );

        for (let index = 0; index < joins.length; index++) {
            const join = joins[index];

            if (hastaJoin && join === hastaJoin) {
                break;
            }

            const option =
                join.querySelector(
                    ".join-table"
                )
                ?.selectedOptions[0];

            const schema = option?.dataset.schema;
            const table = option?.dataset.table;

            if (!schema || !table) {
                continue;
            }

            const sourceId = join.dataset.sourceId;
            const sourceAlias = join.querySelector(".join-source-alias")?.value?.trim();
            const label = sourceAlias ? `${sourceAlias} — ${schema}.${table}` : `${schema}.${table} (Relación ${index + 1})`;

            sources.push({
                sourceId:sourceId,
                schema: schema,
                table: table,
                fullName: `${schema}.${table}`,
                alias: sourceAlias,
                label: label
            });
        }

        return sources;
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

    function esTipoConcatenable(type) {
        return [
            // Texto
            "varchar",
            "nvarchar",
            "char",
            "nchar",
            "text",
            "ntext",

            // Enteros
            "tinyint",
            "smallint",
            "int",
            "bigint",

            // Decimales
            "decimal",
            "numeric",
            "money",
            "smallmoney",
            "float",
            "real",

            // Booleano
            "bit",

            // Fechas
            "date",
            "datetime",
            "datetime2",
            "smalldatetime",
            "time",

            // Identificadores
            "uniqueidentifier"
        ].includes(
            type.toLowerCase()
        );
    }

    reportConcatColumns.addEventListener(
        "input",
        actualizarEstadoColumnas
    );

    function limpiarColumnasConcatenadas() {
        destruirSelectsBuscablesDentro(reportConcatColumns);
        reportConcatColumns.innerHTML ="";
        reportConcatColumnsEmpty.classList.remove("d-none");
        actualizarBadge(concatCountBadge,0);
    }

    function validarConfiguracionReporte(request) {

        if (
            request.columns.length === 0 &&
            request.concatColumns.length === 0 &&
            request.conditionalColumns.length === 0 &&
            request.metrics.length === 0
        ) {
            return {
                valid: false,
                message: "Seleccione al menos una columna, métrica o columna calculada para el reporte."
            };
        }

        for (let i = 0; i < request.joins.length; i++) {
            const join = request.joins[i];

            if (
                !join.leftSourceId ||
                !join.leftSchema ||
                !join.leftTable ||
                !join.leftColumn ||
                !join.rightSourceId ||
                !join.rightSchema ||
                !join.rightTable ||
                !join.rightColumn
            ) {
                return {
                    valid: false,
                    message: `La relación ${i + 1} está incompleta. ` + "Seleccione ambas fuentes, tablas y columnas."
                };
            }
        }

        for (let i = 0; i < request.concatColumns.length; i++) {
            const concat = request.concatColumns[i];

            if (concat.columns.length < 2) {
                return {
                    valid: false,
                    message: `La columna combinada ${i + 1} debe contener al menos dos columnas.`
                };
            }

            if (!concat.alias || !concat.alias.trim()) {
                return {
                    valid: false,
                    message: `La columna combinada ${i + 1} necesita un alias.`
                };
            }

            for (let j = 0; j < concat.columns.length; j++) {

                const column = concat.columns[j];

                if (
                    !column.sourceId ||
                    !column.schema ||
                    !column.table ||
                    !column.column
                ) {
                    return {
                        valid: false,
                        message:
                            `La columna ${j + 1} de la columna combinada ` +
                            `${i + 1} está incompleta.`
                    };
                }
            }
        }

        for (let i = 0; i < request.filters.length; i++) {
            const filter = request.filters[i];

            if (
                !filter.sourceId ||
                !filter.schema ||
                !filter.table ||
                !filter.column ||
                !filter.operator
            ) {
                return {
                    valid: false,
                    message: `El filtro ${i + 1} está incompleto.`
                };
            }

            const noValue = filter.operator === "IS_NULL" || filter.operator === "IS_NOT_NULL";
            const multiple = filter.operator === "IN" || filter.operator === "NOT_IN";

            if (multiple && (!filter.values || filter.values.length === 0)) {
                return {
                    valid: false,
                    message: `El filtro ${i + 1} requiere al menos un valor.`
                };
            }

            if (!noValue && !multiple && (filter.value === null || filter.value === undefined || String(filter.value).trim() === "")) {
                return {
                    valid: false,
                    message: `El filtro ${i + 1} requiere un valor.`
                };
            }
        }

        for (let i = 0; i < request.conditionalColumns.length; i++) {
            const conditional = request.conditionalColumns[i];

            if (!conditional.alias) {
                return {
                    valid: false,
                    message: `La columna condicional ${i + 1} necesita un alias.`
                };
            }

            if (!conditional.cases || conditional.cases.length === 0) {
                return {
                    valid: false,
                    message: `La columna condicional '${conditional.alias}' necesita al menos un WHEN.`
                };
            }

            for (let j = 0; j < conditional.cases.length; j++) {
                const caseWhen = conditional.cases[j];

                if (!caseWhen.conditions || caseWhen.conditions.length === 0) {
                    return {
                        valid: false,
                        message: `El WHEN ${j + 1} de '${conditional.alias}' necesita al menos una condición.`
                    };
                }

                for (let k = 0; k < caseWhen.conditions.length; k++) {
                    const condition = caseWhen.conditions[k];

                    if (
                        !condition.sourceId ||
                        !condition.schema ||
                        !condition.table ||
                        !condition.column ||
                        !condition.operator
                    ) {

                        return {
                            valid: false,
                            message: `La condición ${k + 1} del WHEN ${j + 1} de '${conditional.alias}' está incompleta.`
                        };
                    }

                    const noValue = condition.operator === "IS_NULL" || condition.operator === "IS_NOT_NULL";
                    const multiple = condition.operator === "IN" || condition.operator === "NOT_IN";

                    if (multiple && condition.values.length === 0) {
                        return {
                            valid: false,
                            message: `La condición ${k + 1} del WHEN ${j + 1} necesita valores.`
                        };
                    }

                    if (!noValue && !multiple && (condition.value === null || condition.value === undefined)) {
                        return {
                            valid: false,
                            message: `La condición ${k + 1} del WHEN ${j + 1} necesita un valor.`
                        };
                    }
                }

                const resultValidation = validarResultadoCase(caseWhen.result, `THEN del WHEN ${ j + 1}`);

                if (!resultValidation.valid) {
                    return resultValidation;
                }
            }

            const elseValidation = validarResultadoCase(conditional.elseResult,`ELSE de '${conditional.alias}'`);

            if (!elseValidation.valid) {
                return elseValidation;
            }
        }

        for (let i = 0; i < request.metrics.length;i++) {
            const metric = request.metrics[i];

            if (!metric.alias) {
                return {
                    valid: false,
                    message: `La métrica ${i + 1} necesita un alias.`
                };
            }

            const countAll =
                metric.function === "COUNT" &&
                !metric.column;

            if (
                !countAll &&
                (
                    !metric.sourceId ||
                    !metric.schema ||
                    !metric.table ||
                    !metric.column
                )
            ) {
                return {
                    valid: false,
                    message:
                        `La métrica ${i + 1} no tiene una columna válida.`
                };
            }

            for (let j = 0; j < metric.conditions.length; j++) {

                const condition =
                    metric.conditions[j];


                if (
                    !condition.sourceId ||
                    !condition.schema ||
                    !condition.table ||
                    !condition.column ||
                    !condition.operator
                ) {
                    return {
                        valid: false,
                        message:
                            `La condición ${j + 1} de la métrica ` +
                            `'${metric.alias}' está incompleta.`
                    };
                }


                const noValue =
                    condition.operator === "IS_NULL" ||
                    condition.operator === "IS_NOT_NULL";


                const multiple =
                    condition.operator === "IN" ||
                    condition.operator === "NOT_IN";


                if (
                    multiple &&
                    (
                        !condition.values ||
                        condition.values.length === 0
                    )
                ) {
                    return {
                        valid: false,
                        message:
                            `La condición ${j + 1} de la métrica ` +
                            `'${metric.alias}' requiere valores.`
                    };
                }


                if (
                    !noValue &&
                    !multiple &&
                    (
                        condition.value === null ||
                        condition.value === undefined ||
                        String(
                            condition.value
                        ).trim() === ""
                    )
                ) {
                    return {
                        valid: false,
                        message:
                            `La condición ${j + 1} de la métrica ` +
                            `'${metric.alias}' requiere un valor.`
                    };
                }
            }
        }

        return {valid: true};
    }

    function actualizarBadge(badge, count) {
        badge.textContent = count;
        badge.classList.toggle("has-items", count > 0);
    }

    function obtenerNombreReporte() {
        const name = reportNameInput.value.trim();
        return name.length > 0 ? name : "Reporte " + selectedTable;
    }

    function esTipoNumerico(type) {
        return [
            "tinyint",
            "smallint",
            "int",
            "bigint",
            "decimal",
            "numeric",
            "money",
            "smallmoney",
            "float",
            "real"
        ].includes(
            type.toLowerCase()
        );
    }

    btnAddMetric.addEventListener(
        "click",
        function () {
            agregarMetrica();
        }
    );

    function agregarMetrica() {
        reportMetricsEmpty.classList.add("d-none");

        const metric = document.createElement("div");
        metric.className = "report-query-item report-metric-item";
        metric.dataset.outputOrder = obtenerSiguienteOrdenSalida();
        metric.innerHTML = `
            <div class="report-query-item-header">

                <div>

                    <div class="report-query-item-title">
                        Métrica
                    </div>

                    <div class="text-muted small">
                        Agregado o cálculo sobre una columna.
                    </div>

                </div>


                <button type="button"
                        class="btn btn-sm btn-outline-danger
                               btn-remove-metric">

                    Quitar

                </button>

            </div>


            <div class="report-metric-grid">

                <div>

                    <label class="report-field-label">
                        Función
                    </label>

                    <select class="form-select metric-function">

                        <option value="SUM">
                            SUM - Suma
                        </option>

                        <option value="COUNT">
                            COUNT - Conteo
                        </option>

                        <option value="AVG">
                            AVG - Promedio
                        </option>

                        <option value="MIN">
                            MIN - Mínimo
                        </option>

                        <option value="MAX">
                            MAX - Máximo
                        </option>

                    </select>

                </div>


                <div>

                    <label class="report-field-label">
                        Tabla
                    </label>

                    <select class="form-select metric-table">

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

                    <select class="form-select metric-column"
                            disabled>

                        <option value="">
                            Seleccione primero una tabla
                        </option>

                    </select>

                </div>


                <div>

                    <label class="report-field-label">
                        Alias
                    </label>

                    <input type="text"
                           class="form-control metric-alias"
                           placeholder="Ej. SaldoActual" />

                </div>

            </div>


            <div class="report-metric-options mt-3">

                <label class="form-check">

                    <input type="checkbox"
                           class="form-check-input metric-distinct">

                    <span class="form-check-label">
                        DISTINCT
                    </span>

                </label>


                <label class="form-check">

                    <input type="checkbox"
                           class="form-check-input metric-null-zero"
                           checked>

                    <span class="form-check-label">
                        Sustituir NULL por 0
                    </span>

                </label>


                <label class="form-check metric-count-all-wrapper d-none">

                    <input type="checkbox"
                           class="form-check-input metric-count-all">

                    <span class="form-check-label">
                        Contar todos los registros COUNT(*)
                    </span>

                </label>

            </div>


            <div class="report-metric-arithmetic mt-3">

                <div class="report-section-subtitle">
                    Operación adicional
                </div>

                <div class="text-muted small mb-2">
                    Opcional. Permite dividir, multiplicar,
                    sumar o restar un valor.
                </div>


                <div class="report-query-grid">

                    <div>

                        <label class="report-field-label">
                            Operación
                        </label>

                        <select class="form-select metric-arithmetic-operator">

                            <option value="">
                                Ninguna
                            </option>

                            <option value="+">
                                Sumar (+)
                            </option>

                            <option value="-">
                                Restar (-)
                            </option>

                            <option value="*">
                                Multiplicar (*)
                            </option>

                            <option value="/">
                                Dividir (/)
                            </option>

                        </select>

                    </div>


                    <div>

                        <label class="report-field-label">
                            Valor
                        </label>

                        <input type="number"
                               step="any"
                               class="form-control metric-arithmetic-value"
                               disabled />

                    </div>

                </div>

            </div>


            <div class="report-metric-conditions mt-4">

                <div class="d-flex
                            justify-content-between
                            align-items-center
                            mb-2">

                    <div>

                        <div class="report-section-subtitle">
                            Condiciones del cálculo
                        </div>

                        <div class="text-muted small">
                            Genera expresiones CASE WHEN.
                        </div>

                    </div>


                    <button type="button"
                            class="btn btn-sm btn-outline-secondary
                                   btn-add-metric-condition">

                        <i class="fa fa-plus"></i>
                        Agregar condición

                    </button>

                </div>


                <div class="metric-conditions">
                </div>


                <div class="metric-conditions-empty
                            alert alert-light border">

                    La métrica se calculará sobre todos
                    los registros seleccionados.

                </div>

            </div>
        `;

        reportMetrics.appendChild(metric);
        activarSelectBuscable(
            metric.querySelector(
                ".metric-table"
            )
        );
        actualizarBadge(metricsCountBadge, reportMetrics.children.length);
        actualizarEstadoMetrica(metric);
        actualizarEstadoColumnas();
    }

    async function cargarColumnasMetrica(metric) {

        const tableOption = metric.querySelector(".metric-table").selectedOptions[0];
        const schema = tableOption?.dataset.schema;
        const table = tableOption?.dataset.table;
        const functionName = metric.querySelector(".metric-function").value;
        const countAll = metric.querySelector(".metric-count-all").checked;
        const columnSelect = metric.querySelector(".metric-column");

        if (countAll && functionName === "COUNT") {
             actualizarSelectBuscable(
                columnSelect,
                `
                    <option value="">
                        Todos los registros (*)
                    </option>
                `,
                "",
                true
            );
            return;
        }

        if (!schema || !table) {
            actualizarSelectBuscable(
                columnSelect,
                `
                    <option value="">
                        Seleccione primero una tabla
                    </option>
                `,
                "",
                true
            );
            return;
        }

        actualizarSelectBuscable(
            columnSelect,
            `
                <option value="">
                    Cargando...
                </option>
            `,
            "",
            true
        );

        try {
            const columns = await obtenerColumnasTabla(schema, table);
            const available =
                columns.filter(
                    column => {

                        if (functionName === "SUM" || functionName === "AVG") {
                            return esTipoNumerico(column.dataType);
                        }

                        return true;
                    }
                );

            actualizarSelectBuscable(
                columnSelect,
                `
                    <option value="">
                        Seleccione columna
                    </option>

                    ${available
                        .map(
                            column => `
                                <option
                                    value="${column.name}"
                                    data-type="${column.dataType}">

                                    ${column.name}
                                    (${column.dataType})

                                </option>
                            `
                        )
                        .join("")}
                `,
                "",
                false
            );
        }
        catch (error) {
            await AppAlert.error("No fue posible cargar las columnas", error.message);
        }
    }

    reportMetrics.addEventListener(
        "change",
        async function (event) {

            const metric = event.target.closest(".report-metric-item");

            if (!metric) {
                return;
            }

            // ======================================
            // FUNCIÓN
            // ======================================
            if (event.target.classList.contains("metric-function")) {
                actualizarEstadoMetrica(metric);
                await cargarColumnasMetrica(metric);
            }

            // ======================================
            // TABLA
            // ======================================
            if (event.target.classList.contains("metric-table")) {
                await cargarColumnasMetrica(metric);
            }

            // ======================================
            // COUNT(*)
            // ======================================
            if (event.target.classList.contains("metric-count-all")) {
                actualizarEstadoMetrica(metric);
                await cargarColumnasMetrica(metric);
            }

            // ======================================
            // OPERACIÓN
            // ======================================
            if (event.target.classList.contains("metric-arithmetic-operator")) {
                const valueInput = metric.querySelector(".metric-arithmetic-value");
                valueInput.disabled = !event.target.value;

                if (!event.target.value) {
                    valueInput.value = "";
                }
            }
            
            if (event.target.classList.contains("metric-condition-table")) {

                const condition = event.target.closest(".metric-condition-item");
                const option = event.target.selectedOptions[0];
                const schema = option?.dataset.schema;
                const table = option?.dataset.table;
                const columnSelect = condition.querySelector(".metric-condition-column");
                const sourceId = option?.dataset.sourceId;
                columnSelect.disabled = true;

                if (!schema || !table) {
                    return;
                }

                const columns = await obtenerColumnasTabla(schema, table);

                actualizarSelectBuscable(
                    columnSelect,
                    `
                        <option value="">
                            Seleccione columna
                        </option>

                        ${columns
                            .map(
                                column => `
                                    <option
                                        value="${column.name}"
                                        data-source-id="${sourceId}"
                                        data-schema="${schema}"
                                        data-table="${table}"
                                        data-type="${column.dataType}">

                                        ${column.name}
                                        (${column.dataType})

                                    </option>
                                `
                            )
                            .join("")}
                    `,
                    "",
                    false
                );
            }

            if (event.target.classList.contains("metric-condition-column")) {
                const condition = event.target.closest(".metric-condition-item");
                const option = event.target.selectedOptions[0];
                const type = option?.dataset.type;
                const operator = condition.querySelector(".metric-condition-operator");
                const input = condition.querySelector(".metric-condition-value");

                if (!type) {
                    operator.disabled = true;
                    input.disabled = true;
                    return;
                }

                operator.innerHTML =
                    obtenerOperadores(type)
                        .map(
                            item => `
                                <option value="${item[0]}">
                                    ${item[1]}
                                </option>
                            `
                        )
                        .join("");

                operator.disabled =false;
                input.disabled = false;

                configurarInputFiltro(input, type);
                actualizarValorCondicionMetrica(condition);
            }

            if (event.target.classList.contains("metric-condition-operator")) {
                const condition = event.target.closest(".metric-condition-item");
                actualizarValorCondicionMetrica(condition);
            }

            actualizarEstadoColumnas();
        }
    );

    function actualizarEstadoMetrica(metric) {

        const functionName = metric.querySelector(".metric-function").value;
        const countAllWrapper = metric.querySelector(".metric-count-all-wrapper");
        const countAll = metric.querySelector(".metric-count-all");
        const nullZero = metric.querySelector(".metric-null-zero");
        const arithmeticOperator = metric.querySelector(".metric-arithmetic-operator");
        const arithmeticValue = metric.querySelector(".metric-arithmetic-value");

        if (functionName === "COUNT") {
            countAllWrapper.classList.remove("d-none");
            nullZero.checked = false;
            nullZero.disabled = true;
            arithmeticOperator.value = "";
            arithmeticOperator.disabled = true;
            arithmeticValue.value = "";
            arithmeticValue.disabled = true;
        }
        else {
            countAllWrapper.classList.add("d-none");
            countAll.checked = false;
            nullZero.disabled = false;
            arithmeticOperator.disabled = false;
            arithmeticValue.disabled = !arithmeticOperator.value;
        }
    }

    reportMetrics.addEventListener(
        "click",
        function (event) {

            const addButton = event.target.closest(".btn-add-metric-condition");

            if (addButton) {
                const metric = addButton.closest(".report-metric-item");
                agregarCondicionMetrica(metric);
                return;
            }

            const removeMetric = event.target.closest(".btn-remove-metric");

            if (removeMetric) {
                removeMetric.closest(".report-metric-item").remove();

                if (reportMetrics.children.length === 0) {
                    reportMetricsEmpty.classList.remove("d-none");
                }

                actualizarBadge(metricsCountBadge, reportMetrics.children.length);
                actualizarEstadoColumnas();
                return;
            }


            const removeCondition = event.target.closest(".btn-remove-metric-condition");

            if (removeCondition) {

                const metric = removeCondition.closest(".report-metric-item");

                removeCondition.closest(".metric-condition-item").remove();
                actualizarConectoresCondicionesMetrica(metric);
                actualizarEstadoCondicionesMetrica(metric);
            }
        }
    );

    function agregarCondicionMetrica(metric) {

        const container = metric.querySelector(".metric-conditions");
        const empty = metric.querySelector(".metric-conditions-empty");

        empty.classList.add("d-none");

        const isFirst = container.querySelectorAll(".metric-condition-item").length === 0;
        const condition = document.createElement("div");

        condition.className = "metric-condition-item";
        condition.innerHTML = `
            <div class="metric-condition-grid">

                <div>

                    <label class="report-field-label">
                        Condición
                    </label>

                    <select class="form-select
                                   metric-condition-logical"
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

                    <select class="form-select
                                   metric-condition-table">

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

                    <select class="form-select
                                   metric-condition-column"
                            disabled>

                        <option value="">
                            Seleccione tabla
                        </option>

                    </select>

                </div>


                <div>

                    <label class="report-field-label">
                        Operador
                    </label>

                    <select class="form-select
                                   metric-condition-operator"
                            disabled>

                        <option value="">
                            Seleccione columna
                        </option>

                    </select>

                </div>


                <div>

                    <label class="report-field-label">
                        Valor
                    </label>

                    <input type="text"
                           class="form-control
                                  metric-condition-value"
                           disabled />

                </div>


                <div class="metric-condition-remove">

                    <button type="button"
                            class="btn btn-sm btn-outline-danger
                                   btn-remove-metric-condition">

                        <i class="fa fa-trash"></i>

                    </button>

                </div>

            </div>
        `;

        container.appendChild(condition);
        activarSelectBuscable(
            condition.querySelector(
                ".metric-condition-table"
            )
        );
        actualizarConectoresCondicionesMetrica(metric);
        actualizarEstadoCondicionesMetrica(metric);
    }

    function actualizarConectoresCondicionesMetrica(metric) {
        const conditions = Array.from(metric.querySelectorAll(".metric-condition-item"));

        conditions.forEach(
            (condition, index) => {

                const logical = condition.querySelector(".metric-condition-logical");

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

    function actualizarEstadoCondicionesMetrica(metric) {
        const container = metric.querySelector(".metric-conditions");
        const empty = metric.querySelector(".metric-conditions-empty");

        empty.classList.toggle("d-none", container.children.length > 0);
    }

    function obtenerMetricas() {

        return Array
            .from(reportMetrics.querySelectorAll(".report-metric-item")
            )
            .map(
                metric => {

                    const functionName = metric.querySelector(".metric-function").value;
                    const countAll = metric.querySelector(".metric-count-all").checked;
                    const tableOption = metric.querySelector(".metric-table").selectedOptions[0];
                    const arithmeticOperator = metric.querySelector(".metric-arithmetic-operator").value;
                    const arithmeticValue = metric.querySelector(".metric-arithmetic-value").value;

                    return {
                        function: functionName,
                        schema: countAll ? "" : tableOption?.dataset.schema ?? "",
                        sourceId: countAll ? "" : tableOption?.dataset.sourceId ?? "",
                        table: countAll ? "" : tableOption?.dataset.table ?? "",
                        column: countAll ? "" : metric.querySelector(".metric-column").value,
                        alias: metric.querySelector(".metric-alias").value.trim(),
                        order: Number(metric.dataset.outputOrder) || 0,
                        distinct: metric.querySelector(".metric-distinct").checked,
                        nullAsZero: metric.querySelector(".metric-null-zero").checked,
                        conditions: obtenerCondicionesMetrica(metric),
                        arithmeticOperator: arithmeticOperator || null,
                        arithmeticValue: arithmeticOperator && arithmeticValue !== "" ? Number(arithmeticValue) : null
                    };
                }
            );
    }

    function obtenerCondicionesMetrica(metric) {
        return Array
            .from(metric.querySelectorAll(".metric-condition-item")
            )
            .map(
                condition => {
                    const column = condition.querySelector(".metric-condition-column").selectedOptions[0];
                    const operator = condition.querySelector(".metric-condition-operator").value;
                    const value = condition.querySelector(".metric-condition-value").value;
                    const multiple = operator === "IN" || operator === "NOT_IN";

                    return {
                        logicalOperator: condition.querySelector(".metric-condition-logical").value,
                        schema: column?.dataset.schema ?? "",
                        sourceId: column?.dataset.sourceId ?? "",
                        table: column?.dataset.table ?? "",
                        column: column?.value ?? "",
                        operator: operator,
                        value: multiple ? null : value,
                        values: multiple ? value.split(",").map(x => x.trim()).filter(Boolean) : []
                    };
                }
            );
    }

    function limpiarMetricas() {
        destruirSelectsBuscablesDentro(reportMetrics);
        reportMetrics.innerHTML ="";
        reportMetricsEmpty.classList.remove("d-none");
        actualizarBadge(metricsCountBadge, 0);
    }

    function actualizarValorCondicionMetrica(condition) {
        const operator = condition.querySelector(".metric-condition-operator").value;
        const input = condition.querySelector(".metric-condition-value");
        const columnOption = condition.querySelector(".metric-condition-column").selectedOptions[0];
        const type = columnOption?.dataset.type;
        const noValue = operator === "IS_NULL" || operator === "IS_NOT_NULL";
        const multipleValues = operator === "IN" || operator === "NOT_IN";

        // ==========================================
        // OPERADORES SIN VALOR
        // ==========================================
        if (noValue) {
            input.disabled = true;
            input.value = "";
            input.placeholder = "";
            return;
        }

        input.disabled = false;

        // ==========================================
        // IN / NOT IN
        // ==========================================
        if (multipleValues) {
            input.type = "text";
            input.removeAttribute("min");
            input.removeAttribute("max");
            input.removeAttribute("step");
            input.placeholder = "Ej. 1, 2, 3";
            return;
        }

        // ==========================================
        // VALOR NORMAL
        // ==========================================
        input.placeholder = "";
        if (type) {
            configurarInputFiltro(input,type);
        }
    }

    btnAddConditionalColumn.addEventListener(
        "click",
        function () {
            agregarColumnaCondicional();
        }
    );

    function agregarColumnaCondicional() {
        reportConditionalColumnsEmpty.classList.add("d-none");

        const item = document.createElement("div");

        item.className ="report-query-item report-conditional-column-item";
        item.dataset.outputOrder =obtenerSiguienteOrdenSalida();
        item.innerHTML = `
            <div class="report-query-item-header">

                <div>
                    <div class="report-query-item-title">
                        Columna condicional
                    </div>

                    <div class="text-muted small">
                        Genera una expresión CASE WHEN.
                    </div>
                </div>


                <button type="button"
                        class="btn btn-sm btn-outline-danger
                               btn-remove-conditional-column">

                    Quitar

                </button>

            </div>


            <div class="mb-3">

                <label class="report-field-label">
                    Alias de la columna
                </label>

                <input type="text"
                       class="form-control conditional-column-alias"
                       placeholder="Ej. Departamento" />

            </div>


            <div class="conditional-whens">
            </div>


            <div class="d-flex justify-content-end mb-3">

                <button type="button"
                        class="btn btn-sm btn-outline-primary
                               btn-add-conditional-when">

                    <i class="fa fa-plus"></i>
                    Agregar WHEN

                </button>

            </div>


            <div class="conditional-else-section">

                <div class="report-section-subtitle mb-2">
                    ELSE
                </div>

                ${generarHtmlResultadoCase("conditional-else-result")}

            </div>
        `;

        reportConditionalColumns.appendChild(item);
        agregarWhenCondicional(item);

        const elseEditor = item.querySelector(".conditional-else-result");
        actualizarEstadoResultadoCase(elseEditor);
        actualizarBadge(conditionalColumnsCountBadge, reportConditionalColumns.children.length);
        actualizarEstadoColumnas();
    }

    function generarHtmlResultadoCase(extraClass = "") {
        return `
            <div class="case-result-editor ${extraClass}">

                <div class="report-query-grid">

                    <div>

                        <label class="report-field-label">
                            Tipo de resultado
                        </label>

                        <select class="form-select case-result-type">

                            <option value="VALUE">
                                Valor fijo
                            </option>

                            <option value="COLUMN">
                                Otra columna
                            </option>

                            <option value="NULL">
                                NULL
                            </option>

                        </select>

                    </div>


                    <div class="case-result-value-type-wrapper">

                        <label class="report-field-label">
                            Tipo del valor
                        </label>

                        <select class="form-select case-result-value-type">

                            <option value="string">
                                Texto
                            </option>

                            <option value="int">
                                Entero
                            </option>

                            <option value="decimal">
                                Decimal
                            </option>

                            <option value="date">
                                Fecha
                            </option>

                            <option value="datetime">
                                Fecha y hora
                            </option>

                            <option value="bit">
                                Booleano
                            </option>

                        </select>

                    </div>

                </div>


                <div class="case-result-value-fields mt-3">

                    <label class="report-field-label">
                        Valor
                    </label>

                    <input type="text"
                           class="form-control case-result-value" />

                </div>


                <div class="case-result-column-fields
                            report-query-grid
                            mt-3
                            d-none">

                    <div>

                        <label class="report-field-label">
                            Tabla resultado
                        </label>

                        <select class="form-select case-result-table">

                            <option value="">
                                Seleccione tabla
                            </option>

                            ${obtenerOpcionesTablasConsulta()}

                        </select>

                    </div>


                    <div>

                        <label class="report-field-label">
                            Columna resultado
                        </label>

                        <select class="form-select case-result-column"
                                disabled>

                            <option value="">
                                Seleccione primero una tabla
                            </option>

                        </select>

                    </div>

                </div>

            </div>
        `;
    }

    function agregarWhenCondicional(conditionalColumn) {
        const container = conditionalColumn.querySelector(".conditional-whens");
        const when = document.createElement("div");

        when.className = "conditional-when-item";

        const number = container.querySelectorAll(".conditional-when-item").length + 1;

        when.innerHTML = `
            <div class="conditional-when-header">

                <div class="report-section-subtitle">
                    WHEN ${number}
                </div>


                <button type="button"
                        class="btn btn-sm btn-outline-danger
                               btn-remove-conditional-when">

                    Quitar WHEN

                </button>

            </div>

            <div class="conditional-conditions">
            </div>

            <div class="d-flex
                        justify-content-end
                        mt-2
                        mb-3">

                <button type="button"
                        class="btn btn-sm btn-outline-secondary
                               btn-add-conditional-condition">

                    <i class="fa fa-plus"></i>
                    Agregar condición

                </button>

            </div>

            <div class="conditional-then-section">

                <div class="report-section-subtitle mb-2">
                    THEN
                </div>
                ${generarHtmlResultadoCase("conditional-then-result")}
            </div>
        `;

        container.appendChild(when);
        agregarCondicionWhen(when);

        const resultEditor = when.querySelector(".conditional-then-result");
        actualizarEstadoResultadoCase(resultEditor);
        actualizarNumerosWhen(conditionalColumn);
    }

    function actualizarNumerosWhen(conditionalColumn) {
        const whens = conditionalColumn.querySelectorAll(".conditional-when-item");

        whens.forEach(
            (when, index) => {
                const title = when.querySelector(".conditional-when-header .report-section-subtitle");
                title.textContent = `WHEN ${index + 1}`;
            }
        );
    }

    function agregarCondicionWhen(when) {
        const container = when.querySelector(".conditional-conditions");
        const condition = document.createElement("div");

        condition.className = "conditional-condition-item";

        const isFirst = container.querySelectorAll( ".conditional-condition-item").length === 0;

        condition.innerHTML = `
            <div class="conditional-condition-grid">

                <div>

                    <label class="report-field-label">
                        Condición
                    </label>

                    <select class="form-select conditional-condition-logical" ${isFirst ? "disabled" : ""}>
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

                    <select class="form-select conditional-condition-table">

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

                    <select class="form-select
                                   conditional-condition-column"
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

                    <select class="form-select
                                   conditional-condition-operator"
                            disabled>

                        <option value="">
                            Seleccione columna
                        </option>

                    </select>

                </div>

                <div>

                    <label class="report-field-label">
                        Valor
                    </label>

                    <input type="text"
                           class="form-control
                                  conditional-condition-value"
                           disabled />

                </div>

                <div class="conditional-condition-remove">

                    <button type="button"
                            class="btn btn-sm btn-outline-danger
                                   btn-remove-conditional-condition">

                        <i class="fa fa-trash"></i>

                    </button>

                </div>

            </div>
        `;

        container.appendChild(condition);
        activarSelectBuscable(
            condition.querySelector(
                ".conditional-condition-table"
            )
        );
        actualizarConectoresWhen(when);
    }

    function actualizarConectoresWhen(when) {
        const conditions = Array.from(when.querySelectorAll(".conditional-condition-item"));

        conditions.forEach(
            (condition, index) => {
                const logical = condition.querySelector(".conditional-condition-logical");

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

    reportConditionalColumns.addEventListener(
        "click",
        function (event) {

            // ======================================
            // NUEVO WHEN
            // ======================================
            const addWhen = event.target.closest(".btn-add-conditional-when");

            if (addWhen) {
                const conditional = addWhen.closest(".report-conditional-column-item");
                agregarWhenCondicional(conditional);
                actualizarEstadoColumnas();
                return;
            }

            // ======================================
            // NUEVA CONDICIÓN
            // ======================================
            const addCondition = event.target.closest(".btn-add-conditional-condition");

            if (addCondition) {
                const when = addCondition.closest(".conditional-when-item" );
                agregarCondicionWhen(when);
                return;
            }

            // ======================================
            // QUITAR CONDICIÓN
            // ======================================
            const removeCondition = event.target.closest(".btn-remove-conditional-condition");

            if (removeCondition) {
                const when = removeCondition.closest(".conditional-when-item");
                removeCondition.closest(".conditional-condition-item").remove();
                actualizarConectoresWhen(when);
                return;
            }

            // ======================================
            // QUITAR WHEN
            // ======================================
            const removeWhen = event.target.closest(".btn-remove-conditional-when");

            if (removeWhen) {
                const conditional = removeWhen.closest(".report-conditional-column-item");
                removeWhen.closest(".conditional-when-item").remove();
                actualizarNumerosWhen(conditional);
                actualizarEstadoColumnas();
                return;
            }

            // ======================================
            // QUITAR COLUMNA CONDICIONAL
            // ======================================
            const removeColumn = event.target.closest(".btn-remove-conditional-column");

            if (removeColumn) {
                removeColumn.closest(".report-conditional-column-item").remove();

                if (reportConditionalColumns.children.length === 0) {
                    reportConditionalColumnsEmpty.classList.remove("d-none");
                }

                actualizarBadge(conditionalColumnsCountBadge, reportConditionalColumns.children.length);
                actualizarEstadoColumnas();
            }
        }
    );

    reportConditionalColumns.addEventListener(
        "change",
        async function (event) {
            // ======================================
            // TABLA DE CONDICIÓN
            // ======================================
            if (event.target.classList.contains("conditional-condition-table")) {
                const condition = event.target.closest(".conditional-condition-item");
                const option = event.target.selectedOptions[0];
                const schema = option?.dataset.schema;
                const table = option?.dataset.table;
                const columnSelect = condition.querySelector(".conditional-condition-column");
                const operatorSelect = condition.querySelector(".conditional-condition-operator");
                const input = condition.querySelector(".conditional-condition-value");
                columnSelect.disabled = true;
                operatorSelect.disabled = true;
                input.disabled = true;
                const sourceId = option?.dataset.sourceId;

                actualizarSelectBuscable(
                    columnSelect,
                    `
                        <option value="">
                            Cargando...
                        </option>
                    `,
                    "",
                    true
                );

                if (!schema || !table) {
                    return;
                }

                try {
                    const columns = await obtenerColumnasTabla(schema, table);
                    actualizarSelectBuscable(
                        columnSelect,
                        `
                            <option value="">
                                Seleccione columna
                            </option>

                            ${columns
                                .map(
                                    column => `
                                        <option
                                            value="${column.name}"
                                            data-source-id="${sourceId}"
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
                        `,
                        "",
                        false
                    );
                }
                catch (error) {
                    await AppAlert.error("No fue posible cargar las columnas", error.message);
                }
            }

            // ======================================
            // COLUMNA DE CONDICIÓN
            // ======================================
            if (event.target.classList.contains("conditional-condition-column")) {
                const condition = event.target.closest(".conditional-condition-item");
                const option = event.target.selectedOptions[0];
                const type = option?.dataset.type;
                const operator = condition.querySelector(".conditional-condition-operator");
                const input = condition.querySelector(".conditional-condition-value");

                if (!type) {
                    operator.disabled = true;
                    input.disabled = true;
                    return;
                }

                operator.innerHTML = obtenerOperadores(type)
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
                actualizarValorCondicionCase(condition);
            }

            // ======================================
            // OPERADOR DE CONDICIÓN
            // ======================================
            if (event.target.classList.contains("conditional-condition-operator")) {
                const condition = event.target.closest(".conditional-condition-item");
                actualizarValorCondicionCase(condition);
            }

            // ======================================
            // TIPO RESULTADO THEN / ELSE
            // ======================================
            if (event.target.classList.contains("case-result-type")) {
                const editor = event.target.closest(".case-result-editor");
                actualizarEstadoResultadoCase(editor);
            }

            // ======================================
            // TIPO DE VALOR
            // ======================================
            if (event.target.classList.contains("case-result-value-type")) {
                const editor = event.target.closest(".case-result-editor");
                configurarInputResultadoCase(editor);
            }

            // ======================================
            // TABLA RESULTADO
            // ======================================
            if (event.target.classList.contains("case-result-table")) {
                const editor = event.target.closest(".case-result-editor");
                await cargarColumnasResultadoCase(editor);
            }

            actualizarEstadoColumnas();
        }
    );

    function actualizarValorCondicionCase(condition) {
        const operator = condition.querySelector(".conditional-condition-operator").value;
        const input = condition.querySelector(".conditional-condition-value");
        const columnOption = condition.querySelector(".conditional-condition-column").selectedOptions[0];
        const type = columnOption?.dataset.type;
        const noValue = operator === "IS_NULL" || operator === "IS_NOT_NULL";
        const multiple = operator === "IN" ||operator === "NOT_IN";

        if (noValue) {
            input.disabled = true;
            input.value = "";
            input.placeholder = "";
            return;
        }

        input.disabled = false;

        if (multiple) {
            input.type = "text";
            input.removeAttribute("min");
            input.removeAttribute("max");
            input.removeAttribute("step");
            input.placeholder = "Ej. 57, 58, 60";
            return;
        }

        input.placeholder = "";

        if (type) {
            configurarInputFiltro(input, type);
        }
    }

    function actualizarEstadoResultadoCase(editor) {
        const type = editor.querySelector(".case-result-type").value;
        const valueFields = editor.querySelector(".case-result-value-fields");
        const valueTypeWrapper = editor.querySelector(".case-result-value-type-wrapper");
        const columnFields = editor.querySelector(".case-result-column-fields");

        if (type === "VALUE") {
            valueFields.classList.remove("d-none");
            valueTypeWrapper.classList.remove("d-none");
            columnFields.classList.add("d-none");
            configurarInputResultadoCase(editor);
            return;
        }

        if (type === "COLUMN") {
            valueFields.classList.add("d-none");
            valueTypeWrapper.classList.add("d-none");
            columnFields.classList.remove("d-none");
            activarSelectBuscable(
                editor.querySelector(
                    ".case-result-table"
                )
            );
            return;
        }

        // NULL
        valueFields.classList.add("d-none");
        valueTypeWrapper.classList.add("d-none");
        columnFields.classList.add("d-none");
    }

    function configurarInputResultadoCase(editor) {
        const type = editor.querySelector(".case-result-value-type").value;
        const input = editor.querySelector(".case-result-value");
        input.removeAttribute("min");
        input.removeAttribute("max");
        input.removeAttribute("step");

        switch (type) {
            case "int":
                input.type = "number";
                input.step = "1";
                break;

            case "decimal":
                input.type = "number";
                input.step = "any";
                break;

            case "date":
                input.type = "date";
                break;

            case "datetime":
                input.type = "datetime-local";
                break;

            case "bit":
                input.type = "number";
                input.min = "0";
                input.max = "1";
                input.step = "1";
                break;

            default:
                input.type = "text";
                break;
        }
    }

    async function cargarColumnasResultadoCase(editor) {
        const tableOption = editor.querySelector(".case-result-table").selectedOptions[0];
        const schema = tableOption?.dataset.schema;
        const table = tableOption?.dataset.table;
        const columnSelect = editor.querySelector(".case-result-column" );
        columnSelect.disabled = true;

        if (!schema || !table) {
            columnSelect.innerHTML = `
                <option value="">
                    Seleccione primero una tabla
                </option>
            `;
            return;
        }

        actualizarSelectBuscable(
            columnSelect,
            `
                <option value="">
                    Cargando...
                </option>
            `,
            "",
            true
        );

        try {
            const columns = await obtenerColumnasTabla(schema, table);

            actualizarSelectBuscable(
                columnSelect,
                `
                    <option value="">
                        Seleccione columna
                    </option>

                    ${columns
                        .map(
                            column => `
                                <option value="${column.name}">
                                    ${column.name}
                                    (${column.dataType})
                                </option>
                            `
                        )
                        .join("")}
                `,
                "",
                false
            );
        }
        catch (error) {
            await AppAlert.error("No fue posible cargar las columnas", error.message);
        }
    }

    function obtenerColumnasCondicionales() {

        return Array
            .from(reportConditionalColumns.querySelectorAll(".report-conditional-column-item"))
            .map(
                conditional => {
                    const cases = Array.from(conditional.querySelectorAll(".conditional-when-item"))
                            .map(
                                when => ({
                                    conditions: obtenerCondicionesWhen(when),
                                    result: obtenerResultadoCase(when.querySelector(".conditional-then-result"))
                                })
                            );

                    return {
                        alias: conditional.querySelector(".conditional-column-alias").value.trim(),
                        order:Number(conditional.dataset.outputOrder) || 0,
                        cases: cases,
                        elseResult: obtenerResultadoCase( conditional.querySelector(".conditional-else-result"))
                    };
                }
            );
    }

    function obtenerCondicionesWhen(when) {
        return Array.from(when.querySelectorAll(".conditional-condition-item"))
            .map(
                condition => {
                    const column = condition.querySelector(".conditional-condition-column").selectedOptions[0];
                    const operator = condition.querySelector(".conditional-condition-operator").value;
                    const value = condition.querySelector(".conditional-condition-value").value;
                    const multiple = operator === "IN" || operator === "NOT_IN";

                    return {
                        logicalOperator: condition.querySelector(".conditional-condition-logical").value,
                        sourceId: column?.dataset.sourceId ??"",
                        schema: column?.dataset.schema ?? "",
                        table: column?.dataset.table ?? "",
                        column: column?.value ?? "",
                        operator: operator,
                        value: multiple ? null : value,
                        values: multiple ? value.split(",").map(x => x.trim()).filter(Boolean) : []
                    };
                }
            );
    }

    function obtenerResultadoCase(editor) {
        const resultType = editor.querySelector(".case-result-type").value;

        if (resultType === "COLUMN") {
            const table = editor.querySelector(".case-result-table").selectedOptions[0];

            return {
                resultType: "COLUMN",
                value: null,
                valueType: "string",
                sourceId: table?.dataset.sourceId ?? "",
                schema: table?.dataset.schema ?? "",
                table: table?.dataset.table ?? "",
                column: editor.querySelector(".case-result-column").value
            };
        }

        if (resultType === "NULL") {
            return {
                resultType: "NULL",
                value: null,
                valueType: "string",
                sourceId: "",
                schema: "",
                table: "",
                column: ""
            };
        }

        return {
            resultType: "VALUE",
            value: editor.querySelector(".case-result-value").value,
            valueType: editor.querySelector(".case-result-value-type").value,
            sourceId: "",
            schema: "",
            table: "",
            column: ""
        };
    }

    function validarResultadoCase(
        result,
        description
    ) {

        if (
            result.resultType ===
            "COLUMN"
        ) {

            if (
                !result.sourceId ||
                !result.schema ||
                !result.table ||
                !result.column
            ) {
                return {
                    valid: false,

                    message:
                        `${description}: seleccione la columna que será devuelta.`
                };
            }
        }


        return {
            valid: true
        };
    }

    function limpiarColumnasCondicionales() {
        destruirSelectsBuscablesDentro(reportConditionalColumns);
        reportConditionalColumns.innerHTML = "";
        reportConditionalColumnsEmpty.classList.remove("d-none");
        actualizarBadge(conditionalColumnsCountBadge, 0);
    }

    function obtenerSiguienteOrdenSalida() {
        outputOrderSequence++;
        return outputOrderSequence;
    }

    function obtenerAliasColumna(checkbox) {
        const item = checkbox.closest(".report-column-item");
        const alias = item.querySelector(".report-column-alias")?.value?.trim();
        return alias ? alias : null;
    }

    function agregarColumnaConcatenada() {
        const sources =
            obtenerTablasEnConsulta();


        if (sources.length === 0) {

            AppAlert.warning(
                "Sin fuentes disponibles",
                "No existen tablas disponibles para crear la columna combinada."
            );

            return;
        }


        reportConcatColumnsEmpty
            .classList
            .add(
                "d-none"
            );


        const item =
            document.createElement(
                "div"
            );


        item.className =
            "report-query-item report-concat-item";


        item.dataset.outputOrder =
            obtenerSiguienteOrdenSalida();


        item.innerHTML = `
            <div class="report-query-item-header">

                <div>

                    <div class="report-query-item-title">
                        Columna combinada
                    </div>

                    <div class="text-muted small">
                        Las columnas se concatenarán
                        en el orden mostrado.
                    </div>

                </div>


                <button type="button"
                        class="btn btn-sm btn-outline-danger
                               btn-remove-concat">

                    Quitar

                </button>

            </div>


            <div class="concat-parts">
            </div>


            <div class="mt-3">

                <button type="button"
                        class="btn btn-sm btn-outline-primary
                               btn-add-concat-part">

                    <i class="fa fa-plus"></i>

                    Agregar columna

                </button>

            </div>


            <div class="report-query-grid mt-3">

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

                    <input
                        type="text"
                        class="form-control concat-alias"
                        placeholder="Ej. NombreCompleto" />

                </div>

            </div>
        `;


        reportConcatColumns.appendChild(
            item
        );


        agregarParteConcatenacion(
            item
        );

        agregarParteConcatenacion(
            item
        );


        actualizarBadge(
            concatCountBadge,
            reportConcatColumns.children.length
        );


        actualizarEstadoColumnas();
    }

    function agregarParteConcatenacion(
        concatItem
    ) {

        const container =
            concatItem.querySelector(
                ".concat-parts"
            );


        const part =
            document.createElement(
                "div"
            );


        part.className =
            "concat-part-item report-query-grid mb-2";


        part.innerHTML = `
            <div>

                <label class="report-field-label">
                    Orden
                </label>

                <div class="concat-part-order
                            badge
                            bg-secondary">
                </div>

            </div>


            <div>

                <label class="report-field-label">
                    Fuente
                </label>

                <select class="form-select concat-source">

                    <option value="">
                        Seleccione fuente
                    </option>

                    ${obtenerOpcionesTablasConsulta()}

                </select>

            </div>


            <div>

                <label class="report-field-label">
                    Columna
                </label>

                <select
                    class="form-select concat-part-column"
                    disabled>

                    <option value="">
                        Seleccione primero una fuente
                    </option>

                </select>

            </div>


            <div>

                <label class="report-field-label">
                    Acciones
                </label>

                <div class="d-flex gap-1">

                    <button
                        type="button"
                        class="btn btn-sm btn-outline-secondary
                               btn-concat-up"
                        title="Subir">

                        ↑

                    </button>

                    <button
                        type="button"
                        class="btn btn-sm btn-outline-secondary
                               btn-concat-down"
                        title="Bajar">

                        ↓

                    </button>

                    <button
                        type="button"
                        class="btn btn-sm btn-outline-danger
                               btn-remove-concat-part"
                        title="Quitar">

                        ×

                    </button>

                </div>

            </div>
        `;


        container.appendChild(
            part
        );


        activarSelectBuscable(
            part.querySelector(
                ".concat-source"
            )
        );


        actualizarOrdenPartesConcatenacion(
            concatItem
        );
    }

    function actualizarOrdenPartesConcatenacion(
        item
    ) {

        const parts =
            Array.from(
                item.querySelectorAll(
                    ".concat-part-item"
                )
            );


        parts.forEach(
            (part, index) => {

                part.querySelector(
                    ".concat-part-order"
                ).textContent =
                    index + 1;


                part.querySelector(
                    ".btn-concat-up"
                ).disabled =
                    index === 0;


                part.querySelector(
                    ".btn-concat-down"
                ).disabled =
                    index ===
                    parts.length - 1;
            }
        );
    }

    reportConcatColumns.addEventListener(
        "change",
        async function (event) {

            if (
                !event.target.classList.contains(
                    "concat-source"
                )
            ) {
                actualizarEstadoColumnas();
                return;
            }


            const part =
                event.target.closest(
                    ".concat-part-item"
                );


            const option =
                event.target.selectedOptions[0];


            const schema =
                option?.dataset.schema;

            const table =
                option?.dataset.table;


            const columnSelect =
                part.querySelector(
                    ".concat-part-column"
                );


            if (!schema || !table) {

                actualizarSelectBuscable(
                    columnSelect,
                    `
                        <option value="">
                            Seleccione primero una fuente
                        </option>
                    `,
                    "",
                    true
                );

                return;
            }


            try {

                const columns =
                    await obtenerColumnasTabla(
                        schema,
                        table
                    );


                const availableColumns =
                    columns.filter(
                        column =>
                            esTipoConcatenable(
                                column.dataType
                            )
                    );


                actualizarSelectBuscable(
                    columnSelect,
                    `
                        <option value="">
                            Seleccione columna
                        </option>

                        ${availableColumns
                            .map(
                                column => `
                                    <option
                                        value="${column.name}"
                                        data-type="${column.dataType}">

                                        ${column.name}
                                        (${column.dataType})

                                    </option>
                                `
                            )
                            .join("")}
                    `,
                    "",
                    false
                );

            }
            catch (error) {

                await AppAlert.error(
                    "No fue posible cargar las columnas",
                    error.message
                );
            }


            actualizarEstadoColumnas();
        }
    );

    reportConcatColumns.addEventListener(
        "click",
        function (event) {

            // ======================================
            // AGREGAR PARTE
            // ======================================

            const addPart =
                event.target.closest(
                    ".btn-add-concat-part"
                );


            if (addPart) {

                const item =
                    addPart.closest(
                        ".report-concat-item"
                    );

                agregarParteConcatenacion(
                    item
                );

                actualizarEstadoColumnas();

                return;
            }


            // ======================================
            // SUBIR
            // ======================================

            const up =
                event.target.closest(
                    ".btn-concat-up"
                );


            if (up) {

                const part =
                    up.closest(
                        ".concat-part-item"
                    );

                const previous =
                    part.previousElementSibling;


                if (previous) {

                    part.parentElement.insertBefore(
                        part,
                        previous
                    );
                }


                const item =
                    part.closest(
                        ".report-concat-item"
                    );


                actualizarOrdenPartesConcatenacion(
                    item
                );

                actualizarEstadoColumnas();

                return;
            }


            // ======================================
            // BAJAR
            // ======================================

            const down =
                event.target.closest(
                    ".btn-concat-down"
                );


            if (down) {

                const part =
                    down.closest(
                        ".concat-part-item"
                    );

                const next =
                    part.nextElementSibling;


                if (next) {

                    part.parentElement.insertBefore(
                        next,
                        part
                    );
                }


                const item =
                    part.closest(
                        ".report-concat-item"
                    );


                actualizarOrdenPartesConcatenacion(
                    item
                );

                actualizarEstadoColumnas();

                return;
            }


            // ======================================
            // QUITAR PARTE
            // ======================================

            const removePart =
                event.target.closest(
                    ".btn-remove-concat-part"
                );


            if (removePart) {

                const part =
                    removePart.closest(
                        ".concat-part-item"
                    );

                const item =
                    part.closest(
                        ".report-concat-item"
                    );


                destruirSelectsBuscablesDentro(
                    part
                );


                part.remove();


                actualizarOrdenPartesConcatenacion(
                    item
                );

                actualizarEstadoColumnas();

                return;
            }


            // ======================================
            // QUITAR CONCAT COMPLETO
            // ======================================

            const removeConcat =
                event.target.closest(
                    ".btn-remove-concat"
                );


            if (!removeConcat) {
                return;
            }


            const item =
                removeConcat.closest(
                    ".report-concat-item"
                );


            destruirSelectsBuscablesDentro(
                item
            );


            item.remove();


            if (
                reportConcatColumns.children.length ===
                0
            ) {
                reportConcatColumnsEmpty
                    .classList
                    .remove(
                        "d-none"
                    );
            }


            actualizarEstadoColumnas();


            actualizarBadge(
                concatCountBadge,
                reportConcatColumns.children.length
            );
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
                                    ".concat-part-item"
                                )
                            )
                            .map(
                                part => {

                                    const source =
                                        part.querySelector(
                                            ".concat-source"
                                        )
                                        .selectedOptions[0];


                                    return {
                                        sourceId:
                                            source?.dataset.sourceId ??
                                            "",

                                        schema:
                                            source?.dataset.schema ??
                                            "",

                                        table:
                                            source?.dataset.table ??
                                            "",

                                        column:
                                            part.querySelector(
                                                ".concat-part-column"
                                            ).value
                                    };
                                }
                            )
                            .filter(
                                column =>
                                    column.sourceId &&
                                    column.schema &&
                                    column.table &&
                                    column.column
                            );


                    return {
                        columns:
                            columns,

                        separator:
                            item.querySelector(
                                ".concat-separator"
                            ).value,

                        alias:
                            item.querySelector(
                                ".concat-alias"
                            )
                            .value
                            .trim(),

                        order:
                            Number(
                                item.dataset.outputOrder
                            ) || 0
                    };
                }
            );
    }

    function refrescarFuentesConsulta() {
        const options = obtenerOpcionesTablasConsulta();
        const selectors = [
            ...reportFilters.querySelectorAll(
                ".filter-table"
            ),

            ...reportMetrics.querySelectorAll(
                ".metric-table"
            ),

            ...reportMetrics.querySelectorAll(
                ".metric-condition-table"
            ),

            ...reportConditionalColumns.querySelectorAll(
                ".conditional-condition-table"
            ),

            ...reportConditionalColumns.querySelectorAll(
                ".case-result-table"
            ),

            ...reportConcatColumns.querySelectorAll(
                ".concat-source"
            )
        ];

        selectors.forEach(
            select => {

                const currentValue =
                    select.value;


                actualizarSelectBuscable(
                    select,
                    `
                        <option value="">
                            Seleccione fuente
                        </option>

                        ${options}
                    `,
                    currentValue,
                    false
                );
            }
        );
    }

    function refrescarFuentesOrigenJoins() {
        const joins =
            Array.from(
                reportJoins.querySelectorAll(
                    ".report-join-item"
                )
            );

        joins.forEach(
            join => {
                const select =
                    join.querySelector(
                        ".join-left-table"
                    );
                const currentSourceId = select.value;
                const sources = obtenerTablasEnConsulta(join);
                const options =
                    sources
                        .map(
                            source => `
                                <option
                                    value="${source.sourceId}"
                                    data-source-id="${source.sourceId}"
                                    data-schema="${source.schema}"
                                    data-table="${source.table}">

                                    ${source.label}

                                </option>
                            `
                        )
                        .join("");

                actualizarSelectBuscable(
                    select,
                    `
                        <option value="">
                            Seleccione fuente
                        </option>

                        ${options}
                    `,
                    currentSourceId,
                    false
                );
            }
        );
    }

    reportJoins.addEventListener(
        "input",
        function (event) {

            if (
                !event.target.classList.contains(
                    "join-source-alias"
                )
            ) {
                return;
            }


            const join =
                event.target.closest(
                    ".report-join-item"
                );


            actualizarDescripcionJoin(
                join
            );


            const tableOption =
                join.querySelector(
                    ".join-table"
                )
                ?.selectedOptions[0];


            const schema =
                tableOption?.dataset.schema;

            const table =
                tableOption?.dataset.table;


            if (schema && table) {

                const group =
                    reportColumns.querySelector(
                        `.report-column-group[data-source-id="${join.dataset.sourceId}"]`
                    );


                if (group) {

                    const alias =
                        event.target.value.trim();


                    const title =
                        group.querySelector(
                            ".report-column-group-title"
                        );


                    title.innerHTML = `
                        ${
                            alias
                                ? `${alias} — ${schema}.${table}`
                                : `${schema}.${table}`
                        }

                        <span class="badge bg-light text-dark border ms-2">
                            Relacionada
                        </span>
                    `;
                }
            }


            refrescarFuentesOrigenJoins();
            refrescarFuentesConsulta();
        }
    );
})();