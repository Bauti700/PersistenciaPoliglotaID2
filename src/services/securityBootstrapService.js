import { pgPool } from '../config/database.js';
import bcrypt from 'bcryptjs';

export class SecurityBootstrapService {
  static async bootstrap() {
    try {
      // Crear roles si no existen
      await pgPool.query(`
        INSERT INTO roles (descripcion, nivel_permisos, estado)
        VALUES ('ADMIN', 10, 'ACTIVO'), ('USUARIO', 1, 'ACTIVO')
        ON CONFLICT DO NOTHING
      `);

      // Verificar si ya hay usuarios
      const count = await pgPool.query('SELECT COUNT(*) FROM usuarios');
      if (Number(count.rows[0].count) > 0) {
        return { created: false, message: 'Usuarios ya existentes' };
      }

      // Obtener roles
      const roles = await pgPool.query("SELECT id_rol, descripcion FROM roles WHERE descripcion IN ('ADMIN','USUARIO')");
      const adminRol = roles.rows.find(r => r.descripcion === 'ADMIN')?.id_rol;
      const userRol = roles.rows.find(r => r.descripcion === 'USUARIO')?.id_rol;

      if (!adminRol || !userRol) {
        return { created: false, message: 'Roles no encontrados' };
      }

      // Crear usuarios
      const adminHash = await bcrypt.hash('admin123', 10);
      const userHash = await bcrypt.hash('usuario123', 10);

      await pgPool.query(`
        INSERT INTO usuarios (nombre, apellido, id_rol, email, password_hash, estado)
        VALUES 
          ('Admin', 'Sistema', $1, 'admin@logistica.com', $2, 'ACTIVO'),
          ('Juan', 'Pérez', $3, 'juan.perez@logistica.com', $4, 'ACTIVO'),
          ('María', 'González', $3, 'maria.gonzalez@logistica.com', $4, 'ACTIVO'),
          ('Carlos', 'López', $3, 'carlos.lopez@logistica.com', $4, 'ACTIVO')
        ON CONFLICT (email) DO NOTHING
      `, [adminRol, adminHash, userRol, userHash]);

      console.log('[SecurityBootstrap] Usuarios por defecto creados:');
      console.log('  Admin: admin@logistica.com / admin123');
      console.log('  Usuarios: juan.perez@logistica.com, maria.gonzalez@logistica.com, carlos.lopez@logistica.com / usuario123');

      return { created: true };
    } catch (e) {
      console.warn(`[SecurityBootstrap] Error al crear usuarios por defecto: ${e.message}`);
      return { created: false, error: e.message };
    }
  }
}
