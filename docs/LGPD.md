# LGPD: como o protótipo trata dados pessoais

> **Este documento é um apoio técnico, não um parecer jurídico.** Bases legais, prazos e textos precisam de validação por profissional especializado antes do lançamento. Os dados do controlador e do encarregado são provisórios.

## Papéis

| Papel | Quem | Situação |
| --- | --- | --- |
| Controlador (art. 5º, VI) | A empresa dona do app | `[a definir]` em `server/privacyMap.ts` |
| Encarregado (art. 41) | Pessoa ou empresa nomeada | `[a nomear]`, com e-mail provisório |
| Operadores (art. 5º, VII) | Hospedagem, provedor de e-mail e outros fornecedores | Nenhum no protótipo. Exigem contrato de tratamento. O provedor de e-mail recebe o endereço e o conteúdo das mensagens, inclusive os códigos |
| Empresas contratantes | Recebem dados do freelancer depois da confirmação | **Ponto para o jurídico:** provavelmente controladoras independentes desses dados. Os termos devem limitar o uso a combinar o turno |

## Mapa de dados (art. 37)

A fonte oficial é `server/privacyMap.ts`, a mesma exibida no app.

| Dados | Finalidade | Base legal proposta | Retenção |
| --- | --- | --- | --- |
| Dados do cadastro ainda não confirmado (cifrados) | Provar que o e-mail é da pessoa antes de criar a conta | Procedimentos preliminares a contrato, a pedido do titular (art. 7º, V) | Até 24 horas |
| E-mail e códigos de uso único (só HMAC) | Confirmar endereço, recuperar senha e avisar sobre ações sensíveis | Execução de contrato (art. 7º, V) e legítimo interesse na segurança da conta (art. 7º, IX) | Códigos: até 1 hora |
| Nome, e-mail, telefone, hash da senha | Conta e contato pós-confirmação | Execução de contrato (art. 7º, V) | Enquanto a conta existir |
| Funções, cidade, experiência, valor, apresentação | Mostrar o perfil a empresas de vagas escolhidas pela pessoa | Execução de contrato (art. 7º, V) | Enquanto a conta existir |
| Perfil nas buscas | Empresas encontrarem e convidarem | Consentimento (art. 7º, I) | Até a revogação |
| CNPJ, nome fantasia, segmento, responsável | Identificar a empresa e reduzir fraude | Execução de contrato (art. 7º, V) | Enquanto a conta existir |
| Candidaturas e histórico de turnos | Conectar as partes | Execução de contrato (art. 7º, V) | Permanece sem identificação após a exclusão |
| Mensagens | Combinar o turno | Execução de contrato (art. 7º, V) | 12 meses após o turno |
| Notas de 1 a 5 | Confiança entre as partes | Legítimo interesse (art. 7º, IX e art. 10). **Requer teste de balanceamento documentado** | Enquanto a conta existir |
| IP, data e hora, ações | Obrigação do Marco Civil e segurança | Obrigação legal (art. 7º, II; Marco Civil, art. 15) | 6 meses |
| Comprovantes de consentimento | Provar a escolha do titular | Obrigação legal e ônus da prova (art. 8º, § 2º) | **A definir** (sugestão: 5 anos) |
| E-mail para novidades | Comunicação de produto | Consentimento (art. 7º, I) | Até a revogação |

### O que deliberadamente não coletamos

- **CPF do freelancer**: desnecessário para conectar as partes. Se pagamentos entrarem no produto, o dado passa a ser avaliado para esse fim.
- **Foto**: reduz o risco de discriminação na escolha (art. 6º, IX) e a exposição de dado biométrico em potencial.
- **Data de nascimento**: no protótipo, basta declarar a maioridade.
- **Localização precisa, rastreadores, analytics e cookies de publicidade**.
- **Comentários livres em avaliações**: só a nota, para evitar exposição de terceiros e dados sensíveis.
- **User-Agent completo**: guardamos só uma etiqueta genérica do aparelho.

As fontes são servidas pelo próprio app, então nenhum serviço externo recebe o IP de quem usa.

### Dados sensíveis (art. 5º, II)

O app não pede nenhum, mas campos livres podem recebê-los. Por isso, o campo de apresentação orienta a não incluir esse tipo de informação. Antes do lançamento, avaliar moderação desses campos.

## Direitos do titular (art. 18)

| Direito | Onde está | Testado |
| --- | --- | --- |
| I e II. Confirmação e acesso | Privacidade → Baixar meus dados | Sim |
| III. Correção | Perfil, inclusive troca de e-mail com confirmação pelo endereço novo. O CNPJ não é editável: a correção passa pelo encarregado | Sim |
| IV. Anonimização, bloqueio ou eliminação de dados excessivos | Pedido ao encarregado | Fluxo manual |
| V. Portabilidade | Exportação em JSON. **O formato exigido depende de regulamentação da ANPD** | Sim |
| VI. Eliminação | Privacidade → Excluir minha conta | Sim |
| VII. Informação sobre compartilhamento | "Quem acessou seus dados" e mapa de dados | Sim |
| VIII. Possibilidade de não consentir | Opções desligadas no cadastro, com a consequência explicada | Sim |
| IX. Revogação do consentimento | Privacidade → Suas permissões, com efeito imediato | Sim |
| Peticionar à ANPD (§ 1º) | Citado na política | Texto |

### O que acontece na exclusão

**Apagado na hora**: e-mail, nome completo, telefone, hash da senha, cidade, perfil, CNPJ, endereços de vagas da empresa, sessões, códigos pendentes, mensagens enviadas e mensagens de candidatura. O índice do e-mail também é apagado, e o endereço pode ser usado de novo. Um último e-mail confirma a exclusão: o endereço é usado só para esse envio, depois de apagado do banco.

**Encerrado**: candidaturas abertas e turnos futuros. Vagas abertas de uma empresa são canceladas.

**Mantido, sem nome ou contato, vinculado a um identificador interno** (art. 16, I): registros de acesso, por 6 meses, e comprovantes de consentimento. Isso é **pseudonimização, não anonimização**: esses registros continuam sendo dados pessoais, sujeitos à LGPD, até o fim do prazo.

**Fica para a outra parte**: as mensagens que ela mesma escreveu e as notas agregadas. Na conversa, a parte excluída aparece como "Conta removida".

Depois que dados saem do app (por exemplo, um telefone anotado por quem contratou), a exclusão não os alcança. Os termos precisam tratar disso.

## Consentimento (art. 8º)

- Finalidades separadas, sem nada marcado por padrão.
- Aceite de termos e uso do serviço não se confunde com consentimento opcional.
- Registro somente de inclusão com finalidade, versão da política, decisão e data. A data é a do envio do formulário, mesmo que a confirmação do e-mail venha depois.
- Se o e-mail não for confirmado, nada entra na conta nem no registro: os dados expiram em até 24 horas.
- Revogar é tão simples quanto conceder, e nada do uso principal é condicionado às opções.
- **Pendente:** ao mudar a política, pedir novo aceite quando a mudança exigir.

## Crianças e adolescentes (art. 14)

A plataforma é restrita a maiores de 18 anos, porque envolve trabalho noturno, vedado a menores pela Constituição (art. 7º, XXXIII), e serviço de bebidas alcoólicas. A verificação hoje é só declaração. **O risco é real em um app com vagas em bares**: avaliar verificação documental antes de lançar.

## Decisões automatizadas (art. 20)

Nenhuma decisão que afete a pessoa é automatizada: quem escolhe é a empresa. A ordem da busca usa disponibilidade e nota média. Se surgir um ranking mais elaborado ou recomendação, será preciso explicar os critérios e garantir revisão.

## Segurança (art. 46) e privacidade desde a concepção (art. 46, § 2º)

Veja [SEGURANCA.md](SEGURANCA.md).

## Incidentes (art. 48)

O protótipo não tem operação de resposta. Antes do lançamento, documentar:

1. Quem aciona, quem decide e como contatar o encarregado fora do horário comercial.
2. Contenção: revogar sessões, rotacionar chaves e preservar evidências.
3. Avaliação de risco ao titular.
4. Comunicação à ANPD e aos titulares em até **3 dias úteis** quando houver risco ou dano relevante (Resolução CD/ANPD nº 15/2024). Confirmar prazos e exceções com o jurídico.
5. Registro do incidente, mesmo quando não houver comunicação.

## Antes do lançamento: checklist

- [ ] Parecer jurídico sobre a política, os termos, as bases legais e a retenção
- [ ] Controlador e encarregado definidos e publicados
- [ ] Relatório de impacto (RIPD, art. 38), recomendado pelo volume de dados e pela exposição de dados de trabalhadores
- [ ] Teste de balanceamento do legítimo interesse (avaliações)
- [ ] Contratos com operadores, incluindo o provedor de e-mail, e análise de transferência internacional (art. 33), se hospedagem ou provedor forem fora do Brasil
- [ ] Termos para empresas sobre o uso dos dados recebidos
- [ ] Análise do risco de vínculo empregatício e de responsabilidade da plataforma
- [ ] Plano de resposta a incidentes testado
- [ ] Canal do encarregado funcionando
