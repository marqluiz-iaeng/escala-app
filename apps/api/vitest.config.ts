import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
          exclude: ['test/db/**'],
          setupFiles: ['./test/setup.ts'],
          // Subir o NestJS pode passar de 10 segundos em uma máquina sob carga.
          hookTimeout: 30_000,
        },
      },
      {
        // Sobe um PostgreSQL real por Testcontainers. Exige o Docker ligado.
        test: {
          name: 'db',
          include: ['test/db/**/*.spec.ts'],
          globalSetup: ['./test/db/global-setup.ts'],
          // Os arquivos dividem o mesmo banco, então rodam um de cada vez.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 180_000,
        },
      },
    ],
  },
});
