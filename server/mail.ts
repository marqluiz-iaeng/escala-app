import nodemailer from 'nodemailer';
import type { Config } from './config.ts';

export type Mail = { to: string; subject: string; text: string };
export type StoredMail = Mail & { at: number };

export type Mailer = {
  send(mail: Mail): Promise<void>;
  /** Só existe sem provedor configurado: guarda as mensagens em memória, nunca em disco. */
  outbox?: StoredMail[];
};

const OUTBOX_LIMIT = 50;

export function createMailer(config: Config): Mailer {
  if (config.smtpUrl) {
    const transport = nodemailer.createTransport({
      url: config.smtpUrl,
      // Em produção, recusa enviar código ou aviso por uma conexão sem criptografia.
      requireTLS: config.production,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    return {
      async send(mail) {
        await transport.sendMail({ from: config.mailFrom, ...mail });
      },
    };
  }

  const outbox: StoredMail[] = [];
  return {
    outbox,
    async send(mail) {
      outbox.push({ ...mail, at: Date.now() });
      if (outbox.length > OUTBOX_LIMIT) outbox.shift();
    },
  };
}

export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 1)}•••@${domain}`;
}

// Só texto puro e sem links: facilita identificar golpes e não há HTML para injetar.
// O código nunca vai no assunto, para não aparecer em notificações de tela bloqueada.
const FOOTER = 'Nunca pedimos sua senha por e-mail, e nossos e-mails não têm links.\n\nEscala';

export const templates = {
  signupCode: (code: string) => ({
    subject: 'Confirme seu e-mail no Escala',
    text: `Seu código de confirmação é:\n\n${code}\n\nEle vale por 1 hora. Digite o código no app para concluir o cadastro.\n\nNão pediu este cadastro? Ignore este e-mail: a conta não será criada e os dados informados serão apagados.\n\n${FOOTER}`,
  }),
  accountExists: () => ({
    subject: 'Tentativa de cadastro com seu e-mail',
    text: `Alguém tentou criar uma conta no Escala com este e-mail, mas você já tem uma.\n\nSe foi você, entre no app ou use "Esqueci minha senha". Se não foi, pode ignorar: nada mudou na sua conta.\n\n${FOOTER}`,
  }),
  passwordReset: (code: string) => ({
    subject: 'Recuperação de senha do Escala',
    text: `Seu código para criar uma nova senha é:\n\n${code}\n\nEle vale por 15 minutos. Não compartilhe com ninguém.\n\nNão pediu? Ignore este e-mail: sua senha continua a mesma.\n\n${FOOTER}`,
  }),
  passwordChanged: () => ({
    subject: 'Sua senha do Escala foi alterada',
    text: `A senha da sua conta foi alterada, e os aparelhos conectados foram desconectados.\n\nNão foi você? Use "Esqueci minha senha" agora para retomar o acesso e fale com nosso encarregado de dados.\n\n${FOOTER}`,
  }),
  emailChangeCode: (code: string) => ({
    subject: 'Confirme seu novo e-mail no Escala',
    text: `Seu código para confirmar este e-mail é:\n\n${code}\n\nEle vale por 15 minutos.\n\nNão pediu esta troca? Ignore este e-mail: nada será alterado.\n\n${FOOTER}`,
  }),
  emailInUse: () => ({
    subject: 'Tentativa de usar seu e-mail no Escala',
    text: `Alguém tentou trocar o e-mail de outra conta do Escala para este endereço. Como ele já está em uso, nada foi alterado.\n\nSe foi você, entre na conta que já usa este e-mail. Se não foi, pode ignorar.\n\n${FOOTER}`,
  }),
  emailChanged: (maskedNewEmail: string) => ({
    subject: 'O e-mail da sua conta do Escala foi alterado',
    text: `O e-mail da sua conta foi trocado para ${maskedNewEmail}, e os outros aparelhos foram desconectados.\n\nNão foi você? Fale imediatamente com nosso encarregado de dados.\n\n${FOOTER}`,
  }),
  accountLocked: () => ({
    subject: 'Tentativas de acesso à sua conta do Escala',
    text: `Bloqueamos o acesso à sua conta por 15 minutos depois de várias tentativas com a senha errada.\n\nSe foi você, aguarde ou use "Esqueci minha senha", que libera o acesso na hora. Se não foi, recomendamos trocar sua senha.\n\n${FOOTER}`,
  }),
  dataExported: () => ({
    subject: 'Uma cópia dos seus dados foi gerada no Escala',
    text: `Uma cópia dos seus dados pessoais acabou de ser gerada a partir da sua conta.\n\nNão foi você? Troque sua senha agora e desconecte os outros aparelhos em Privacidade e segurança.\n\n${FOOTER}`,
  }),
  accountDeleted: () => ({
    subject: 'Sua conta do Escala foi excluída',
    text: `Sua conta foi excluída e seus dados pessoais foram apagados. Mantemos apenas os registros exigidos por lei, sem seu nome ou contato.\n\nEste é o último e-mail que você recebe de nós.\n\nEscala`,
  }),
};
