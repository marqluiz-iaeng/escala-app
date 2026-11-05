import type { Pool, PoolClient } from 'pg';

/**
 * Roda `work` em uma transação com o usuário da requisição definido.
 * O valor vale só para esta transação (o `true` de set_config), então não vaza para
 * a próxima requisição que reutilizar a conexão do pool. Sem usuário, as políticas de RLS negam.
 */
export async function withUser<T>(
  pool: Pool,
  userId: string | null,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.user_id', $1, true)`, [userId ?? '']);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
