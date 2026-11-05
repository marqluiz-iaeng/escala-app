# ADR-0006: Criptografia por campo com chave em KMS

**Status:** proposta.

## Contexto

O prompt pede criptografia por coluna para dados sensíveis, com `pgcrypto` ou envelope via KMS, mais hash para busca e unicidade. O protótipo já cifra na aplicação, com AES-256-GCM e HMAC, usando chave em variável de ambiente.

## Decisão

- **Cifrar na aplicação**, com envelope: chave de dados protegida por KMS. Em desenvolvimento, chave local.
- **AES-256-GCM**, com o contexto do campo como dado autenticado. O formato já tem versão, para permitir rotação.
- **Índice cego por HMAC**, com chave separada, para busca exata e unicidade de CPF, CNPJ e e-mail.
- **Rotação** por tarefa em segundo plano, que recifra com a chave nova.

## Alternativas

- **`pgcrypto`:** a chave ou o texto em claro trafegam nas consultas e podem parar em logs e estatísticas do banco. Reaproveitaria menos código testado.

## Consequências

- O banco, sozinho, não revela esses dados, mesmo com acesso total.
- Campos cifrados só aceitam busca exata pelo índice cego. Não há busca parcial nem ordenação.
- Perder a chave significa perder os dados. Backup da chave separado do backup do banco.
- O teste que lê os bytes do banco, procurando dados em claro, é portado do protótipo.
