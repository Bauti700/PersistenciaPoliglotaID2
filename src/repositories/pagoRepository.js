import { pgPool } from '../config/database.js';

export class PagoRepository {
  /**
   * Registra un pago (cobro a cliente o pago a proveedor/operador)
   */
  static async registrarPago({ id_factura, monto, medio_pago, referencia_comprobante = null }) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const resFac = await client.query(`
        SELECT f.*, a.tipo_actor, a.razon_social 
        FROM facturas f 
        JOIN actores a ON f.id_cliente = a.id_actor 
        WHERE f.id_factura = $1;
      `, [id_factura]);

      if (resFac.rows.length === 0) throw new Error(`Factura con ID ${id_factura} no encontrada.`);

      const factura = resFac.rows[0];
      const montoNum = Number(monto);
      if (montoNum <= 0) throw new Error('El monto del pago debe ser mayor a cero.');

      let tipo_pago = 'COBRO_CLIENTE';
      if (factura.tipo_factura === 'RECIBIDA') {
        tipo_pago = factura.tipo_actor === 'PROVEEDOR' ? 'PAGO_PROVEEDOR' : 'PAGO_OPERADOR';
      }

      const resPago = await client.query(`
        INSERT INTO pagos (id_factura, tipo_pago, monto, medio_pago, referencia_comprobante)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `, [id_factura, tipo_pago, montoNum, medio_pago, referencia_comprobante || `REF-${Date.now().toString().slice(-6)}`]);

      // Verificar total acumulado de pagos para esta factura
      const sumRes = await client.query(`SELECT COALESCE(SUM(monto), 0) AS total_pagado FROM pagos WHERE id_factura = $1;`, [id_factura]);
      const totalPagado = Number(sumRes.rows[0].total_pagado);

      let estadoActualizado = factura.estado;
      if (totalPagado >= Number(factura.importe_total)) {
        await client.query(`UPDATE facturas SET estado = 'PAGADA' WHERE id_factura = $1;`, [id_factura]);
        estadoActualizado = 'PAGADA';
      }

      // Actualizar cuenta corriente según tipo de actor y factura:
      // - Si es factura emitida a cliente: el cobro cancela la deuda (+ monto en CC)
      // - Si es factura recibida de proveedor/operador: el pago disminuye la deuda con el tercero (- monto en CC)
      if (factura.tipo_factura === 'EMITIDA') {
        await client.query(`
          UPDATE cuentas_corrientes
          SET saldo = saldo + $1, fecha_actualizacion = CURRENT_TIMESTAMP
          WHERE id_actor = $2;
        `, [montoNum, factura.id_cliente]);
      } else {
        await client.query(`
          UPDATE cuentas_corrientes
          SET saldo = saldo - $1, fecha_actualizacion = CURRENT_TIMESTAMP
          WHERE id_actor = $2;
        `, [montoNum, factura.id_cliente]);
      }

      await client.query('COMMIT');
      return {
        pago: resPago.rows[0],
        factura_id: factura.id_factura,
        estado_factura: estadoActualizado,
        actor: factura.razon_social,
        tipo_actor: factura.tipo_actor,
        total_pagado: totalPagado
      };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}

export { PagoRepository as pagoRepository };
