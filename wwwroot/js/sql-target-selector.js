(() => {
    const connectionForm = document.getElementById("connectionForm");
    const btnTestConnection = document.getElementById("btnTestConnection");
    const connectionResult = document.getElementById("connectionResult");
    const databaseSection = document.getElementById("databaseSection");
    const databaseSelect = document.getElementById("databaseSelect");
    const tableSection = document.getElementById("tableSection");
    const tableSelect = document.getElementById("tableSelect");
    const stepConectar = document.getElementById("stepConectar");
    const stepBaseDatos = document.getElementById("stepBaseDatos");
    const stepTabla = document.getElementById("stepTabla");
    const testConnectionUrl = connectionForm.dataset.testUrl;
    const getTablesUrl = connectionForm.dataset.tablesUrl;

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
                    noResultsText:
                        "No se encontraron resultados",
                    noChoicesText:
                        "No hay opciones disponibles",
                    searchPlaceholderValue:
                        "Buscar...",
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

    function establecerSelectBuscableDisabled(select, disabled) {
        select.disabled = disabled;

        if (!select._choicesInstance) {
            return;
        }

        if (disabled) {
            select._choicesInstance.disable();
        }
        else {
            select._choicesInstance.enable();
        }
    }

    // ==========================================
    // PROBAR CONEXIÓN
    // ==========================================
    connectionForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            limpiarBasesDatos();
            limpiarTablas();
            btnTestConnection.disabled = true;
            btnTestConnection.innerText = "Conectando...";
            connectionResult.classList.add("d-none");

            const formData = new FormData(connectionForm);

            try {

                const response =
                    await fetch(
                        testConnectionUrl,
                        {
                            method: "POST",
                            body: formData
                        }
                    );

                if (!response.ok) {
                    throw new Error(`Error HTTP ${response.status}`);
                }

                const data = await response.json();

                connectionResult.classList.remove(
                    "d-none",
                    "hy-result-ok",
                    "hy-result-error"
                );

                if (data.success) {

                    connectionResult.classList.add(
                        "hy-result-ok"
                    );

                    stepConectar.classList.add(
                        "is-done"
                    );

                    stepConectar.classList.remove(
                        "is-active"
                    );

                    stepBaseDatos.classList.add(
                        "is-active"
                    );

                    cargarBasesDatos(data.databases);
                }
                else {

                    connectionResult.classList.add(
                        "hy-result-error"
                    );
                }

                connectionResult.innerText = data.message;
            }
            catch (error) {
                connectionResult.classList.remove(
                    "d-none",
                    "hy-result-ok"
                );

                connectionResult.classList.add(
                    "hy-result-error"
                );

                connectionResult.innerText = "Ocurrió un error al intentar conectar: " + error.message;
            }
            finally {
                btnTestConnection.disabled = false;
                btnTestConnection.innerText = "Probar conexión";
            }
        }
    );


    // ==========================================
    // CAMBIO DE BASE DE DATOS
    // ==========================================
    databaseSelect.addEventListener(
        "change",
        async function () {

            const database = this.value;

            limpiarTablas();

            if (!database) {

                stepBaseDatos.classList.remove(
                    "is-done"
                );

                stepBaseDatos.classList.add(
                    "is-active"
                );

                stepTabla.classList.remove(
                    "is-active"
                );

                return;
            }

            stepBaseDatos.classList.remove(
                "is-active"
            );

            stepBaseDatos.classList.add(
                "is-done"
            );

            stepTabla.classList.add(
                "is-active"
            );

            await cargarTablas(
                database
            );
        }
    );


    // ==========================================
    // CARGAR BASES DE DATOS
    // ==========================================
    function cargarBasesDatos(databases) {
        const options =
            databases
                .map(
                    database => `
                        <option value="${database}">
                            ${database}
                        </option>
                    `
                )
                .join("");

        actualizarSelectBuscable(
            databaseSelect,
            `
                <option value="">
                    Seleccione una base de datos
                </option>

                ${options}
            `,
            "",
            false
        );

        databaseSection.classList.remove(
            "d-none"
        );
    }

    // ==========================================
    // CARGAR TABLAS
    // ==========================================
    async function cargarTablas(database) {
        const formData = new FormData(connectionForm);

        formData.append("Database", database);

        try {
            establecerSelectBuscableDisabled(databaseSelect, true);

            actualizarSelectBuscable(
                tableSelect,
                `
                    <option value="">
                        Cargando tablas...
                    </option>
                `,
                "",
                true
            );

            tableSection.classList.remove("d-none");

            const response =
                await fetch(
                    getTablesUrl,
                    {
                        method: "POST",
                        body: formData
                    }
                );

            if (!response.ok) {
                throw new Error(`Error HTTP ${response.status}`);
            }

            const data = await response.json();

            if (!data.success) {

                throw new Error(data.message);
            }

            const tableOptions =
                data.tables
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

            actualizarSelectBuscable(
                tableSelect,
                `
                    <option value="">
                        Seleccione una tabla
                    </option>

                    ${tableOptions}
                `,
                "",
                false
            );
        }
        catch (error) {
            limpiarTablas();

            await AppAlert.error("No fue posible obtener las tablas", error.message);
        }
        finally {
            establecerSelectBuscableDisabled(databaseSelect, false);
        }
    }

    // ==========================================
    // CAMBIO DE TABLA
    // ==========================================
    tableSelect.addEventListener(
        "change",
        function () {

            if (!this.value) {

                stepTabla.classList.remove(
                    "is-done",
                    "is-active"
                );

                document.dispatchEvent(
                    new CustomEvent(
                        "sqlTargetCleared"
                    )
                );

                return;
            }

            const selectedOption = this.options[this.selectedIndex];

            stepTabla.classList.remove(
                "is-active"
            );

            stepTabla.classList.add(
                "is-done"
            );

            document.dispatchEvent(
                new CustomEvent(
                    "sqlTargetSelected",
                    {
                        detail: {
                            database: databaseSelect.value,
                            schema: selectedOption.dataset.schema,
                            table: selectedOption.dataset.table
                        }
                    }
                )
            );
        }
    );


    // ==========================================
    // LIMPIAR BASES DE DATOS
    // ==========================================
    function limpiarBasesDatos() {
        destruirSelectBuscable(databaseSelect);
        databaseSelect.innerHTML = '<option value="">Seleccione una base de datos</option>';
        databaseSelect.disabled = false;
        databaseSection.classList.add("d-none");
        stepConectar.classList.remove("is-done");
        stepBaseDatos.classList.remove("is-active", "is-done");
        limpiarTablas();
    }


    // ==========================================
    // LIMPIAR TABLAS
    // ==========================================
    function limpiarTablas() {
        destruirSelectBuscable(tableSelect);
        tableSelect.innerHTML = `
            <option value="">
                Seleccione una tabla
            </option>
        `;
        tableSelect.disabled = false;
        tableSection.classList.add("d-none");
        stepTabla.classList.remove("is-active", "is-done");
        document.dispatchEvent(
            new CustomEvent(
                "sqlTargetCleared"
            )
        );
    }
})();