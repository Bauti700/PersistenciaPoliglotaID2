export async function menuABMEntidad(nombrePlural, nombreSingular, repo, idField, ask) {
  let salir = false;
  while (!salir) {
    console.log(`\n--- LISTADO DE ${nombrePlural.toUpperCase()} (PostgreSQL) ---`);
    const items = await repo.listarTodos();
    if (items.length === 0) {
      console.log(`No hay ${nombrePlural.toLowerCase()} registrados.\n`);
    } else {
      console.table(items.map(it => ({
        ID: it[idField],
        Razon_Social: it.razon_social,
        CUIT: it.cuit,
        Email: it.email,
        Telefono: it.telefono || '-',
        Direccion: it.direccion || '-',
        Pais: it.pais,
        Estado: it.estado,
        Saldo_CC: `$ ${it.saldo || 0}`
      })));
    }

    console.log(`Acciones para ${nombrePlural}:`);
    console.log(`  1. Dar de alta nuevo ${nombreSingular.toLowerCase()}`);
    console.log(`  2. Modificar ${nombreSingular.toLowerCase()}`);
    console.log(`  3. Dar de baja ${nombreSingular.toLowerCase()} (baja lógica: INACTIVO)`);
    console.log(`  4. Activar ${nombreSingular.toLowerCase()}`);
    console.log(`  5. Eliminar ${nombreSingular.toLowerCase()} definitivamente (baja física)`);
    console.log(`  6. Consultar ${nombreSingular.toLowerCase()} por ID`);
    console.log(`  0. Volver al menú de entidades`);

    const accion = (await ask(`Seleccione acción (0-6) > `)).trim();

    if (accion === '1') {
      console.log(`\n--- ALTA DE ${nombreSingular.toUpperCase()} ---`);
      const razon_social = (await ask('Razón Social: ')).trim();
      const cuit = (await ask('CUIT: ')).trim();
      const email = (await ask('Email: ')).trim();
      const telefono = (await ask('Teléfono (opcional): ')).trim() || null;
      const direccion = (await ask('Dirección (opcional): ')).trim() || null;
      const pais = (await ask('País: ')).trim();

      const nuevo = await repo.crear({ razon_social, cuit, email, telefono, direccion, pais });
      console.log(`\nâœ“ ${nombreSingular} creado exitosamente:`, nuevo);
    } else if (accion === '2') {
      const id = Number(await ask(`ID del ${nombreSingular} a modificar: `));
      const existente = await repo.obtenerPorId(id);
      if (!existente) {
        console.log(`âš  ${nombreSingular} con ID ${id} no encontrado.`);
        continue;
      }
      console.log('Presione ENTER para mantener el valor actual:');
      const razon_social = (await ask(`Razón Social [${existente.razon_social}]: `)).trim() || existente.razon_social;
      const email = (await ask(`Email [${existente.email}]: `)).trim() || existente.email;
      const telefono = (await ask(`Teléfono [${existente.telefono || ''}]: `)).trim() || existente.telefono;
      const direccion = (await ask(`Dirección [${existente.direccion || ''}]: `)).trim() || existente.direccion;
      const pais = (await ask(`País [${existente.pais}]: `)).trim() || existente.pais;

      const modificado = await repo.actualizar(id, { razon_social, email, telefono, direccion, pais });
      console.log(`\nâœ“ ${nombreSingular} actualizado exitosamente:`, modificado);
    } else if (accion === '3') {
      const id = Number(await ask(`ID del ${nombreSingular} a dar de baja: `));
      const existente = await repo.obtenerPorId(id);
      if (!existente) {
        console.log(`âš  ${nombreSingular} con ID ${id} no encontrado.`);
        continue;
      }
      const confirmar = (await ask(`¿Confirma la baja lógica de "${existente.razon_social}"? (s/n): `)).trim().toLowerCase();
      if (confirmar === 's') {
        const resBaja = await repo.darDeBaja(id);
        console.log(`\nâœ“ ${nombreSingular} dado de baja (estado INACTIVO):`, resBaja);
      } else {
        console.log('Operación cancelada.');
      }
    } else if (accion === '4') {
      const id = Number(await ask(`ID del ${nombreSingular} a activar: `));
      const resAct = await repo.activar(id);
      if (resAct) {
        console.log(`\nâœ“ ${nombreSingular} reactivado (estado ACTIVO):`, resAct);
      } else {
        console.log(`âš  ${nombreSingular} no encontrado.`);
      }
    } else if (accion === '5') {
      const id = Number(await ask(`ID del ${nombreSingular} a eliminar DEFINITIVAMENTE: `));
      const existente = await repo.obtenerPorId(id);
      if (!existente) {
        console.log(`âš  ${nombreSingular} con ID ${id} no encontrado.`);
        continue;
      }
      const confirmar = (await ask(`¿Está seguro de ELIMINAR FÍSICAMENTE a "${existente.razon_social}"? Esta acción no se puede deshacer. (s/n): `)).trim().toLowerCase();
      if (confirmar === 's') {
        try {
          const resEliminado = await repo.eliminar(id);
          console.log(`\nâœ“ ${nombreSingular} eliminado de la base de datos:`, resEliminado);
        } catch (err) {
          console.error(`\nâš  No se pudo eliminar: ${err.message}`);
        }
      } else {
        console.log('Operación cancelada.');
      }
    } else if (accion === '6') {
      const id = Number(await ask(`ID del ${nombreSingular}: `));
      const item = await repo.obtenerPorId(id);
      if (!item) {
        console.log(`âš  ${nombreSingular} no encontrado.`);
      } else {
        console.table([item]);
      }
    } else if (accion === '0') {
      salir = true;
    }
  }
}


