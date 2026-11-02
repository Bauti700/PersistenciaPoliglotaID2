import { pgPool } from '../config/database.js';
import { CuentaCorrienteRepository } from './cuentaCorrienteRepository.js';
import {
  enteroPositivo,
  montoPositivo,
  textoOpcional,
  unoDe,
  errorValidacion,
  MEDIOS_PAGO
} from '../utils/validation.js';

function redondear(valor) {
  return Math.round(Number(valor) * 100) / 100;
}

export class PagoRepository {
  /**
   * Registra un pago (cobro a cliente o pago a proveedor/operador).
   * Bloquea la factura para evitar sobrepagos por concurrencia.
   */
  static async registrarPago({ id_factura, monto, medio_pago, referencia_comprobante = null }) {
    const idFactura = enteroPositivo(id_factura, 'id_factura');
    const montoNum = montoPositivo(monto, 'monto');
    const medio = unoDe(medio_pago, MEDIOS_PAGO, 'medio_pago');
    const referencia = textoOpcional(referencia_comprobante, 'referencia_comprobante', { max: 100 });

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      const resFac = await client.query(`
        SELECT f.*, a.razon_social
        FROM facturas f
        JOIN (
          SELECT id_cliente AS id_actor, 'CLIENTE' AS tipo_actor, razon_social FROM clientes
          UNION ALL
          SELECT id_proveedor AS id_actor, 'PROVEEDOR' AS tipo_actor, razon_social FROM proveedores
          UNION ALL
          SELECT id_operador AS id_actor, 'OPERADOR' AS tipo_actor, razon_social FROM operadores
        ) a ON f.id_cliente = a.id_actor AND f.tipo_actor = a.tipo_actor
        WHERE f.id_factura = $1
        FOR UPDATE OF f;
      `, [idFactura]);

      if (resFac.rows.length === 0) {
        throw errorValidacion(`Factura con ID ${idFactura} no encontrada.`, 404);
      }

      const factura = resFac.rows[0];
      if (factura.estado === 'PAGADA') {
        throw errorValidacion(`La factura ${idFactura} ya está PAGADA.`, 409);
      }
      if (factura.estado === 'ANULADA') {
        throw errorValidacion(`La factura ${idFactura} está ANULADA y no admite pagos.`, 409);
      }

      const sumRes = await client.query(
        'SELECT COALESCE(SUM(monto), 0) AS total_pagado FROM pagos WHERE id_factura = $1;',
        [idFactura]
      );
      const totalPagado = Number(sumRes.rows[0].total_pagado);
      const importeTotal = Number(factura.importe_total);
      const saldoPendiente = redondear(importeTotal - totalPagado);

      if (saldoPendiente <= 0) {
        throw errorValidacion(`La factura ${idFactura} no tiene saldo pendiente.`, 409);
      }
      if (montoNum > saldoPendiente + 0.001) {
        throw errorValidacion(
          `El monto $${montoNum} supera el saldo pendiente de $${saldoPendiente} de la factura ${idFactura}.`,
          409
        );
      }

      let tipo_pago = 'COBRO_CLIENTE';
      if (factura.tipo_factura === 'RECIBIDA') {
        tipo_pago = factura.tipo_actor === 'PROVEEDOR' ? 'PAGO_PROVEEDOR' : 'PAGO_OPERADOR';
      }

      const resPago = await client.query(`
        INSERT INTO pagos (id_factura, tipo_pago, monto, medio_pago, referencia_comprobante)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `, [
        idFactura,
        tipo_pago,
        montoNum,
        medio,
        referencia || `REF-${Date.now().toString().slice(-6)}`
      ]);

      const nuevoTotalPagado = redondear(totalPagado + montoNum);
      const nuevoEstado = nuevoTotalPagado >= importeTotal - 0.001 ? 'PAGADA' : 'PENDIENTE';
      await client.query(
        'UPDATE facturas SET estado = $2 WHERE id_factura = $1;',
        [idFactura, nuevoEstado]
      );

      // Actualizar cuenta corriente según tipo de actor y factura:
      // - Factura emitida a cliente: el cobro cancela la deuda (+ monto en CC)
      // - Factura recibida de proveedor/operador: el pago disminuye la deuda (- monto)
      const delta = factura.tipo_factura === 'EMITIDA' ? montoNum : -montoNum;
      const saldoCuenta = await CuentaCorrienteRepository.aplicarMovimiento(client, {
        id_actor: factura.id_cliente,
        tipo_actor: factura.tipo_actor,
        delta
      });

      await client.query('COMMIT');
      return {
        pago: resPago.rows[0],
        factura_id: factura.id_factura,
        estado_factura: nuevoEstado,
        actor: factura.razon_social,
        tipo_actor: factura.tipo_actor,
        total_pagado: nuevoTotalPagado,
        saldo_pendiente: redondear(importeTotal - nuevoTotalPagado),
        saldo_cuenta_corriente: saldoCuenta
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
