# ADR-0002: App nativo em Expo e migração do protótipo

**Status:** proposta.

## Contexto

O protótipo é um app web instalável, em React. O prompt pede iOS e Android com Keychain/Keystore, biometria, push, login nativo e padrões visuais das plataformas, e manda não reescrever o que funciona sem justificar.

## Decisão

Criar `apps/mobile` com Expo SDK 58, React Native 0.88 e Expo Router, usando development build. Mover o protótipo para `legacy/prototype` na Fase 1 e removê-lo na Fase 9, quando o app tiver paridade.

Regras de negócio e de privacidade são portadas, e os cenários dos 84 testes viram testes de integração da nova API.

## Alternativas

- **Manter a PWA:** não atende a Keychain, biometria nem push confiável no iOS.
- **Capacitor sobre a PWA:** reaproveitaria telas, mas ficaria longe dos componentes nativos pedidos pelo prompt.

## Consequências

- As telas são refeitas. A identidade visual é mantida como tokens.
- O protótipo continua rodando durante a transição, como referência.
- `create-expo-app` ainda gera SDK 57 até o novo Expo Go sair, então usamos `--template default@sdk-58`.
