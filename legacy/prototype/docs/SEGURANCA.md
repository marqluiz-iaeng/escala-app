# Segurança

O que o protótipo já faz, como foi testado e o que falta. Rode a verificação com `npm test`.

## Resumo das decisões

| Risco | Defesa | Onde |
| --- | --- | --- |
| Roubo do banco de dados | E-mail, telefone, nome completo, CNPJ, endereços, mensagens e IPs cifrados com AES-256-GCM, cada cifra amarrada ao seu campo. A busca por e-mail e CNPJ usa HMAC (índice cego). A chave fica fora do banco | `server/vault.ts` |
| Vazamento de senhas | scrypt com N=2¹⁷, r=8, p=1 e sal individual. Regra de senha com mínimo de 10 caracteres, bloqueio de senhas comuns e da que contém o e-mail | `server/vault.ts`, `server/domain.ts` |
| Roubo de sessão | Token aleatório de 256 bits. O banco guarda só o hash. Cookie `HttpOnly`, `SameSite=Strict` e, em produção, `Secure` com prefixo `__Host-`. Expira em 12 h sem uso ou 7 dias no total. Revogável pelo usuário | `server/http.ts` |
| Força bruta | Limite por IP e bloqueio de 15 min da conta após 5 falhas | `server/app.ts`, `routes/auth.ts` |
| Descobrir quem tem conta | Login, cadastro, recuperação de senha e troca de e-mail respondem igual para quem tem e quem não tem conta, com custo de hash parecido. Só quem controla a caixa de entrada descobre o caso. **Limitação:** o cadastro avisa quando um CNPJ já existe, porque o dado não é segredo | `routes/auth.ts`, `routes/me.ts` |
| Usar o e-mail de outra pessoa | A conta só nasce depois da confirmação. Até lá, os dados ficam cifrados em área temporária, por no máximo 24 horas | `routes/auth.ts` |
| Pré-sequestro de conta | Confirmar exige o código **e** a senha do cadastro. Quem inicia um cadastro com o e-mail da vítima não recebe o código, e a vítima não ativa uma conta com a senha do atacante | `routes/auth.ts` |
| Adivinhar códigos | 6 dígitos sorteados com gerador criptográfico, 5 tentativas por código, validade de 1 hora no cadastro e de 15 min nos demais fluxos, limite por IP e por endereço. Reenviar invalida o anterior | `server/codes.ts` |
| Roubo de códigos do banco | Só HMAC com chave, amarrado à finalidade e ao titular. Um código não serve em outro fluxo nem para outra conta | `server/codes.ts` |
| Bombardeio de e-mails | No máximo 5 mensagens por hora para cada endereço. Passou disso, nada é enviado, com a mesma resposta | `server/codes.ts` |
| Sequestro pela recuperação de senha | Redefinir derruba todas as sessões, avisa o titular e não entra automaticamente | `routes/auth.ts` |
| Golpes por e-mail | Só texto puro, sem links, sem dados pessoais e sem o código no assunto | `server/mail.ts` |
| Troca indevida de e-mail | Exige a senha e o código enviado ao endereço novo. O antigo é avisado, e os outros aparelhos são desconectados | `routes/me.ts` |
| CSRF | `SameSite=Strict`, cabeçalho próprio obrigatório, checagem de `Origin` e `Sec-Fetch-Site`, sem CORS | `server/http.ts` |
| XSS | React escapa o conteúdo, e a CSP não permite script ou estilo inline nem origens externas | `client/`, `server/app.ts` |
| Acesso a dados de outra conta (IDOR) | Toda rota confere o dono do objeto e responde 404. IDs são UUID aleatórios | `routes/*` |
| Permissões indevidas | Papel checado no servidor e campos extras recusados (`strictObject`), o que impede mass assignment | `routes/*` |
| Injeção de SQL | Só consultas parametrizadas e curingas de `LIKE` escapados | `routes/gigs.ts` |
| Exposição excessiva | Respostas montadas campo a campo. Endereço, nome completo e telefone só são liberados no turno confirmado | `routes/applications.ts` |
| Ações sensíveis com sessão aberta | Exportar, excluir, trocar a senha e trocar o e-mail pedem a senha de novo. O titular recebe um aviso por e-mail | `routes/privacy.ts`, `routes/me.ts` |
| Vazamento por erro ou log | Erros genéricos ao cliente, sem pilha. Sem log de requisições ou corpo. `Cache-Control: no-store` na API | `server/http.ts` |
| Configuração insegura | Em produção, o servidor recusa o modo demonstração e a falta de chaves, de `APP_ORIGIN` ou de provedor de e-mail, e exige TLS no envio | `server/config.ts`, `server/mail.ts` |
| Dependências | Poucas, com versão exata e lockfile. `npm audit` sem alertas em 04/11/2026 | `package.json` |

## O que os testes cobrem

`server/test/security.test.ts` e `server/test/email.test.ts` sobem o app de verdade, com banco e chaves temporários, e fazem requisições HTTP. Alguns exemplos:

- O arquivo do banco é lido em bytes para garantir que dados pessoais não estão em claro.
- Uma empresa tenta ler e alterar vagas e candidaturas de outra.
- Um token copiado continua inválido depois do logout.
- Um perfil some da busca assim que o consentimento é revogado.
- Depois da exclusão, as colunas pessoais estão nulas e o login falha.
- O código da vítima, com a senha errada, não cria a conta iniciada por um atacante.
- O sexto palpite é recusado, mesmo que acerte o código.
- O envio por SMTP é conferido contra um servidor local, pelo protocolo real.

Para confirmar que os testes não passam à toa, removemos proteções, uma de cada vez, e verificamos que falham. Foram 20 no total, como CSRF, checagem de dono, criptografia, máscara do chat, filtro de consentimento, senha na confirmação, limite de tentativas e uso único do código.

**Isso não substitui um teste de invasão independente**, que continua sendo necessário antes de lidar com dados reais.

## Limitações conhecidas

### Bloqueiam o lançamento

- **Provedor de e-mail ainda não contratado.** O envio por SMTP só foi testado contra um servidor local. Sem SPF, DKIM e DMARC no domínio, os códigos podem cair no spam ou o domínio pode ser falsificado.
- **Sem HTTPS próprio.** Rodar atrás de um proxy com TLS e definir `TRUST_PROXY`. Sem isso, o limite por IP deixa de funcionar corretamente.
- **Limite de tentativas em memória.** Reinicia com o servidor e não funciona com várias instâncias. Usar Redis ou similar.
- **Chaves em variável de ambiente, sem rotação implementada.** O formato já tem versão (`v1.`), mas falta o processo. Usar um gerenciador (KMS ou cofre).
- **O CNPJ passa só pela validação de dígitos.** Falta consultar uma base oficial.
- **SQLite em arquivo único, sem backup.** Migrar para PostgreSQL gerenciado, com backup criptografado e com plano para refletir exclusões nos backups.
- **Bloqueio por conta pode ser usado para incomodar alguém**: quem conhece um e-mail consegue travá-lo por 15 min. O titular é avisado e destrava na hora com "Esqueci minha senha", mas o incômodo existe. Avaliar CAPTCHA ou limites mais finos com tráfego real.

### Recomendado em seguida

- Segundo fator (TOTP ou passkeys), ao menos para empresas.
- Hash encadeado nos registros de auditoria, para detectar adulteração.
- Denúncia e bloqueio de usuários, além de revisão de vagas suspeitas.
- Política para arquivos, antes de permitir qualquer envio de foto ou documento.
- Limites por conta, além de por IP, para dificultar a coleta em massa de perfis.
- Atualização automática de dependências e análise estática no CI.
- A máscara do chat evita acidentes, mas não é à prova de quem escreve o número por extenso.

## Colocando em produção

```bash
openssl rand -base64 32
```

Gere um valor para `ESCALA_ENC_KEY` e outro para `ESCALA_HMAC_KEY`, guarde no cofre de segredos da hospedagem junto com a `SMTP_URL`, que contém a senha do provedor, e configure conforme o `.env.example`. **Perder a chave de criptografia significa perder os dados cifrados**, e o backup dela precisa ficar separado do backup do banco.

Nunca versione `.env` nem `data/`: os dois já estão no `.gitignore`.
