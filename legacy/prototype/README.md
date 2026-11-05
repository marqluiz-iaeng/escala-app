# Protótipo web do Escala

> Mantido só como referência até a Fase 9 do [plano](../../docs/PLAN.md). O produto novo fica em `apps/` e `packages/`.

Protótipo de um hub que conecta **freelancers** (bartenders, garçons, atendentes, músicos, recepcionistas e outras funções de festas e eventos) a **empresas** (produtoras musicais, festas e entretenimento, bares e restaurantes, hostels e pousadas).

Foi feito para validar o produto e a abordagem de privacidade. **Ainda não está pronto para dados reais**: veja [o que falta antes de lançar](#o-que-falta-antes-de-lançar).

## Como rodar

Requer Node 24 ou superior.

Na raiz do monorepo:

```bash
corepack pnpm install
```

```bash
corepack pnpm --filter @escala/prototype start
```

Abra <http://localhost:4173> e use os botões de demonstração na tela inicial. As chaves locais e os dados fictícios são criados na primeira execução.

**E-mails na demonstração:** nenhum e-mail real é enviado. Os códigos de cadastro, recuperação de senha e troca de e-mail aparecem em uma caixa de entrada simulada, na própria tela do código. Ações sensíveis têm limite de 20 tentativas a cada 15 minutos por IP. Se você atingir o limite testando, reinicie o servidor.

| Comando | O que faz |
| --- | --- |
| `npm start` | Compila a interface e sobe o app em uma única porta |
| `npm test` | Roda os testes de segurança, LGPD e regras de negócio |
| `npm run typecheck` | Confere os tipos do servidor e da interface |
| `npm run reset` | Apaga o banco local para recriar os dados fictícios (com o servidor parado) |
| `npm run dev:server` e `npm run dev:client` | Desenvolvimento com recarga automática, em dois terminais (interface em <http://localhost:5173>) |

Para abrir no celular, na mesma rede, use `HOST=0.0.0.0 APP_ORIGIN=http://SEU-IP:4173 npm start`. O app pode ser instalado na tela inicial, como PWA. Sem HTTPS, alguns navegadores limitam a instalação.

## O que dá para fazer

**Freelancer**: filtrar vagas por função, data, cidade e texto; candidatar-se em um toque; aceitar convites; conversar com a empresa; ver o contato e o endereço depois da confirmação; avaliar o turno; ligar e desligar a disponibilidade.

**Empresa**: publicar vagas com prévia ao vivo; escolher candidatos; buscar talentos e enviar convites; conversar; confirmar turnos; encerrar ou cancelar vagas.

**As duas contas**: confirmação de e-mail no cadastro, recuperação de senha, troca de e-mail, central de privacidade com quem acessou os dados, permissões, histórico de consentimentos, exportação, correção, exclusão da conta, troca de senha e desconexão de aparelhos.

## Como a privacidade aparece no produto

1. **Identidade em etapas.** Antes da confirmação, a empresa vê "Ana M.", sem foto, telefone ou e-mail. Na confirmação, as duas partes recebem nome completo e telefone, e o freelancer recebe o endereço exato. O acesso se fecha 30 dias depois do turno.
2. **Contato não escapa pelo chat.** Telefones, e-mails e links de WhatsApp ou Telegram são mascarados no servidor, antes de serem salvos, até a confirmação.
3. **Fora das buscas por padrão.** Aparecer para empresas é um consentimento separado, que vem desligado e tem efeito imediato ao ser revogado.
4. **Acesso visível.** Cada visualização de perfil ou contato aparece no histórico da pessoa.
5. **Conta só depois da confirmação.** Até o e-mail ser confirmado, os dados ficam cifrados em uma área temporária e são apagados em até 24 horas. Ninguém consegue usar o app com o e-mail de outra pessoa.
6. **Avisos de segurança.** O titular recebe um e-mail quando a senha ou o e-mail mudam, quando a conta é bloqueada por tentativas erradas e quando uma cópia dos dados é gerada.

## Estrutura

```text
server/          API em Express e TypeScript, executada direto pelo Node
  vault.ts       Criptografia dos campos, índice cego e hash de senha
  codes.ts       Códigos de uso único e limite de e-mails por endereço
  mail.ts        Envio por SMTP, caixa simulada e textos dos e-mails
  http.ts        Sessão, CSRF, autorização, auditoria e erros
  privacyMap.ts  Mapa de dados exibido no app e na política
  routes/        Autenticação, vagas, candidaturas, talentos, privacidade
  test/          Testes de segurança e LGPD
client/          Interface em React e Vite
docs/            LGPD.md e SEGURANCA.md
```

O banco é SQLite (`node:sqlite`) para não exigir instalação no protótipo. Em produção, a recomendação é PostgreSQL gerenciado.

## O que falta antes de lançar

Em ordem de prioridade:

1. **Revisão jurídica** da política, dos termos, das bases legais e da relação de trabalho entre as partes. O texto do app é um rascunho técnico, não um parecer. Definir controlador e encarregado, hoje marcados entre colchetes.
2. **Provedor de e-mail.** Os fluxos estão prontos e o envio por SMTP foi testado contra um servidor local, mas ainda falta contratar um provedor, configurar `SMTP_URL` e `MAIL_FROM` e publicar SPF, DKIM e DMARC no domínio.
3. **Verificação real de empresas** (consulta do CNPJ). Hoje só os dígitos verificadores são checados, e o selo das contas de demonstração vem dos dados fictícios.
4. **Verificação de idade.** Hoje é autodeclaração.
5. **Infraestrutura de produção**: HTTPS, PostgreSQL com backup criptografado, chaves em cofre de segredos, limites de tentativas em armazenamento compartilhado, monitoramento e teste de invasão independente.
6. **Segurança e moderação**: segundo fator de autenticação, denúncia de vagas e perfis, e bloqueio de usuários.
7. **Produto**: notificações, pagamentos e apps nativos, se a validação justificar.

Detalhes em [docs/SEGURANCA.md](docs/SEGURANCA.md) e [docs/LGPD.md](../../docs/LGPD.md).
