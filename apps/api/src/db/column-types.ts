import { customType } from 'drizzle-orm/pg-core';

// Tipos que o drizzle-kit não reconhece ao ler o banco. O db:pull troca os `unknown` por estes.

/** Ponto geográfico. Na escrita e na leitura, é manipulado em SQL com as funções do PostGIS. */
export const geography = customType<{ data: string; driverData: string }>({
  dataType: () => 'extensions.geography(Point, 4326)',
});

/** Centavos cabem com folga em um number, e o driver entrega bigint como texto. */
export const moneyCents = customType<{ data: number; driverData: string }>({
  dataType: () => 'money_cents',
  fromDriver: (value) => Number(value),
});

export const currencyCode = customType<{ data: string; driverData: string }>({
  dataType: () => 'currency_code',
});

export const tsvector = customType<{ data: string; driverData: string }>({
  dataType: () => 'tsvector',
});
