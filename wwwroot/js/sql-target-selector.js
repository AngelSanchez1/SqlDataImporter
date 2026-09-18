(() => {
    const connectionForm =
        document.getElementById("connectionForm");

    const btnTestConnection =
        document.getElementById("btnTestConnection");

    const connectionResult =
        document.getElementById("connectionResult");

    const databaseSection =
        document.getElementById("databaseSection");

    const databaseSelect =
        document.getElementById("databaseSelect");

    const tableSection =
        document.getElementById("tableSection");

    const tableSelect =
        document.getElementById("tableSelect");

    const stepConectar =
        document.getElementById("stepConectar");

    const stepBaseDatos =
        document.getElementById("stepBaseDatos");

    const stepTabla =
        document.getElementById("stepTabla");


    // URLs generadas por Razor en la vista parcial
    const testConnectionUrl =
        connectionForm.dataset.testUrl;

    const getTablesUrl =
        connectionForm.dataset.tablesUrl;


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
            btnTestConnection.innerText =
                "Conectando...";

            connectionResult.classList.add(
                "d-none"
            );

            const formData =
                new FormData(connectionForm);

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

                    throw new Error(
                        `Error HTTP ${response.status}`
                    );
                }

                const data =
                    await response.json();

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

                    cargarBasesDatos(
                        data.databases
                    );

                }
                else {

                    connectionResult.classList.add(
                        "hy-result-error"
                    );
                }

                connectionResult.innerText =
                    data.message;

            }
            catch (error) {

                console.error(error);

                connectionResult.classList.remove(
                    "d-none",
                    "hy-result-ok"
                );

                connectionResult.classList.add(
                    "hy-result-error"
                );

                connectionResult.innerText =
                    "Ocurrió un error al intentar conectar: "
                    + error.message;

            }
            finally {

                btnTestConnection.disabled = false;

                btnTestConnection.innerText =
                    "Probar conexión";
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

    function cargarBasesDatos(
        databases
    ) {

        databaseSelect.innerHTML =
            '<option value="">Seleccione una base de datos</option>';

        databases.forEach(
            function (database) {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    database;

                option.textContent =
                    database;

                databaseSelect.appendChild(
                    option
                );
            }
        );

        databaseSection.classList.remove(
            "d-none"
        );
    }


    // ==========================================
    // CARGAR TABLAS
    // ==========================================

    async function cargarTablas(
        database
    ) {

        const formData =
            new FormData(
                connectionForm
            );

        formData.append(
            "Database",
            database
        );

        try {

            databaseSelect.disabled = true;
            tableSelect.disabled = true;

            tableSelect.innerHTML =
                '<option value="">Cargando tablas...</option>';

            tableSection.classList.remove(
                "d-none"
            );

            const response =
                await fetch(
                    getTablesUrl,
                    {
                        method: "POST",
                        body: formData
                    }
                );

            if (!response.ok) {

                throw new Error(
                    `Error HTTP ${response.status}`
                );
            }

            const data =
                await response.json();

            if (!data.success) {

                throw new Error(
                    data.message
                );
            }

            tableSelect.innerHTML =
                '<option value="">Seleccione una tabla</option>';

            data.tables.forEach(
                function (table) {

                    const option =
                        document.createElement(
                            "option"
                        );

                    option.value =
                        table.fullName;

                    option.textContent =
                        table.fullName;

                    option.dataset.schema =
                        table.schema;

                    option.dataset.table =
                        table.name;

                    tableSelect.appendChild(
                        option
                    );
                }
            );

        }
        catch (error) {

            limpiarTablas();

            AppAlert.error(
                "No fue posible obtener las tablas: "
                + error.message
            );

        }
        finally {

            databaseSelect.disabled =
                false;

            tableSelect.disabled =
                false;
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

                            database:
                                databaseSelect.value,

                            schema:
                                selectedOption.dataset.schema,

                            table:
                                selectedOption.dataset.table
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

        databaseSelect.innerHTML =
            '<option value="">Seleccione una base de datos</option>';

        databaseSection.classList.add(
            "d-none"
        );

        stepConectar.classList.remove(
            "is-done"
        );

        stepBaseDatos.classList.remove(
            "is-active",
            "is-done"
        );

        limpiarTablas();
    }


    // ==========================================
    // LIMPIAR TABLAS
    // ==========================================

    function limpiarTablas() {

        tableSelect.innerHTML =
            '<option value="">Seleccione una tabla</option>';

        tableSection.classList.add(
            "d-none"
        );

        stepTabla.classList.remove(
            "is-active",
            "is-done"
        );

        document.dispatchEvent(
            new CustomEvent(
                "sqlTargetCleared"
            )
        );
    }
})();