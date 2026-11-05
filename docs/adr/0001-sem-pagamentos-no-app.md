# ADR-0001: Sem pagamentos no app

**Status:** aceita em 04/11/2026, por decisão do responsável pelo produto.

## Contexto

O prompt previa custódia, split e repasses com o Pagar.me. Primeiro, o responsável pediu para trocar o Pagar.me por uma camada open source de integração com um intermediário bancário. Depois, decidiu remover os pagamentos do app.

## Decisão

O app não cobra, não retém e não repassa dinheiro. A empresa paga o freelancer diretamente, fora do app. O Escala registra valor, unidade e data combinada, e as partes marcam "paguei" e "recebi".

As tabelas `payments`, `payment_splits`, `payouts`, `refunds`, `ledger_entries`, `payment_webhook_events` e `recipients` não serão criadas. A Fase 5 foi cancelada.

## Consequências

- **Positivas:** sem custódia de terceiros, PCI, reconciliação, chargeback ou Mecanismo Especial de Devolução do Pix, e com menos infraestrutura.
- **Negativas:** sem receita no plano, sem proteção contra calote e com contrato falso mais barato, o que exige proteções na reputação.
- **Produto:** o app e os termos precisam dizer que o Escala não processa nem garante pagamentos.

## Se pagamentos voltarem

O que levantamos antes da remoção serve de ponto de partida, não de parecer:

- **Open source avaliado:** o [Hyperswitch](https://github.com/juspay/hyperswitch) (Apache-2.0) estava ativo, com a v1.129.0 em 02/11/2026. O [conector Santander](https://github.com/juspay/hyperswitch/releases) tinha Pix e boleto na entrada, e a [lista de repasses](https://docs.hyperswitch.io/other-features/connectors/payouts) incluía Pix via Santander e Itaú.
- **Limites:** ele [não liquida dinheiro](https://selfhostyourself.com/alternative-to/spreedly), e o [split](https://docs.hyperswitch.io/other-features/connectors/split-payments) só cobria Stripe, Adyen, Xendit e Payload. Com o [vault próprio](https://docs.hyperswitch.io/integration-guide/workflows/vault/self-hosted-and-in-house-pci), a responsabilidade pelo PCI DSS seria nossa.
- **Regulação:** receber e reter dinheiro de terceiros precisa de parecer antes de qualquer uso real. A [Resolução BCB 494/2025](https://www.legisweb.com.br/legislacao/?id=483156) exige autorização prévia de instituições de pagamento, e a [522/2025](https://www.legisweb.com.br/legislacao/?id=486238) trata de subcredenciadores.
- **Alternativa de custódia:** parceiros regulados oferecem contas com retenção, como o [Asaas](https://central.ajuda.asaas.com/hc/pt-br/articles/32096847160859-Termos-e-Condi%C3%A7%C3%B5es-de-Uso) e a [Celcoin](https://developers.celcoin.com.br/reference/post_escrow-api-v1-accounts-account-id-pix-charges).
