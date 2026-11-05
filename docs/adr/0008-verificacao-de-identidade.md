# ADR-0008: Verificação de identidade sem biometria obrigatória

**Status:** proposta.

## Contexto

O prompt pede CPF para freelancer, CNPJ para empresa e selfie com documento antes de receber pagamentos. Sem pagamentos no app ([ADR-0001](0001-sem-pagamentos-no-app.md)), a selfie perdeu seu motivo principal. Biometria é dado sensível (LGPD, arts. 5º, II e 11), e as [orientações preliminares da ANPD](https://www.baptista.com.br/o-que-o-eca-digital-e-as-orientacoes-preliminares-da-anpd-significam-para-o-seu-negocio/) pedem cautela com soluções mais intrusivas. A idade continua importante, porque há turno noturno e bebida alcoólica.

## Decisão

- **Freelancer:** CPF e data de nascimento são obrigatórios e conferidos por um provedor antes do primeiro contrato. O CPF cifrado com índice cego também impede que alguém banido volte com outra conta.
- **Empresa:** CNPJ com dígitos verificados e consulta de situação cadastral. O selo só vem depois da consulta aprovada.
- **Selfie e documento:** opcionais, para o selo "identidade verificada". Imagens ficam com o provedor. Guardamos só status e referência.
- **Provedores:** por interface, com mock até haver credencial.

## Alternativas

- **Selfie obrigatória para todos:** mais confiança, mas coleta dado sensível de todo mundo e aumenta o abandono no cadastro.
- **Só autodeclaração de idade:** insuficiente para o risco e pode conflitar com o [ECA Digital](https://www.csmv.com.br/boletins/eca-digital-e-regulamentado-e-anpd-publica-orientacoes-sobre-verificacao-etaria/).

## Consequências

- Conferir CPF e data de nascimento não prova que quem preenche é o titular. Quem precisar de mais segurança pode exigir o selo.
- O enquadramento no ECA Digital e o tratamento do CPF precisam de validação jurídica.
- O mapa de dados e a política de privacidade passam a incluir CPF e data de nascimento.
