# ADR-0007: Login sem senha, validação no backend e tokens rotativos

**Status:** proposta.

## Contexto

O prompt pede Google, Apple, LinkedIn e e-mail com código, com vínculo de várias identidades, tokens curtos e refresh rotativo. O protótipo usa senha e cookie de sessão.

## Decisão

- **Sem senha.** Saem hash de senha, recuperação e bloqueio por senha. O código por e-mail reaproveita a proteção do protótipo.
- **Apple e Google:** login nativo com `nonce`. A API valida assinatura, `aud`, `iss`, `exp` e `nonce`.
- **LinkedIn:** fluxo mediado pela API, com o segredo só no servidor e PKCE entre app e API. A [documentação do LinkedIn](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow-native) diz que o PKCE para apps nativos depende de liberação por eles.
- **Tokens:** acesso de 15 minutos. Renovação rotativa, guardada como hash. Reuso revoga a sessão. No aparelho, ficam em `expo-secure-store`.
- **Vínculo:** só com sessão autenticada ou prova por código. E-mail igual nunca vincula sozinho.
- **Tokens de terceiros:** descartados depois do login, conforme a regra 5.1.1(v) da Apple. A exceção é o token da Apple necessário para a revogação na exclusão da conta.
- **2FA:** TOTP com códigos de recuperação. Obrigatório para admins e donos de empresa.

## Consequências

- Menos superfície: não há senha para vazar ou reutilizar.
- O acesso depende do e-mail ou do provedor. Por isso, a pessoa pode vincular mais de uma identidade.
- Hide My Email exige registrar o domínio de envio na Apple, ou os códigos não chegam.
- O login do LinkedIn não verifica identidade, então não concede selo.
- O app passa de cookie para tokens. O painel web mantém cookie `HttpOnly` com as defesas de CSRF já testadas.
- A exigência de 2FA pode pesar para donos de pequenos bares. Observar na ativação.
