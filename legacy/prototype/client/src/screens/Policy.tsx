import { ArrowLeft, TriangleAlert } from 'lucide-react';
import { useApp } from '../hooks';

export function Policy() {
  const { meta, me } = useApp();
  const { controller } = meta;
  return (
    <article className="page policy">
      <a href={me ? '#/privacidade' : '#/'} className="auth-back"><ArrowLeft size={18} aria-hidden /> Voltar</a>
      <h1>Política de privacidade</h1>
      <p className="muted">Versão {meta.policyVersion}</p>

      <div className="draft-note" role="note">
        <TriangleAlert size={18} aria-hidden />
        <p><b>Rascunho de protótipo.</b> Este texto precisa de revisão jurídica, e os dados entre colchetes precisam ser preenchidos antes de qualquer lançamento público.</p>
      </div>

      <h2>O resumo</h2>
      <ul>
        <li>Pedimos só o necessário para conectar quem trabalha a quem contrata.</li>
        <li>Seu telefone, nome completo e o endereço do turno só são liberados depois que a contratação é confirmada.</li>
        <li>Não vendemos dados, não usamos cookies de publicidade nem rastreadores de terceiros.</li>
        <li>Você pode baixar, corrigir ou excluir seus dados dentro do app, a qualquer momento.</li>
      </ul>

      <h2>Quem é responsável</h2>
      <p>
        O controlador dos dados é <b>{controller.name}</b>. Nosso encarregado pelo tratamento de dados pessoais é <b>{controller.dpoName}</b>, que atende pelo e-mail <a className="text-link" href={`mailto:${controller.dpoEmail}`}>{controller.dpoEmail}</a>.
      </p>

      <h2>O que tratamos e por quê</h2>
      <div className="policy-table" role="region" aria-label="Tabela de dados tratados" tabIndex={0}>
        <table>
          <thead>
            <tr><th>Tipo</th><th>Dados</th><th>Finalidade</th><th>Base legal (LGPD)</th><th>Prazo</th></tr>
          </thead>
          <tbody>
            {meta.dataMap.map((d) => (
              <tr key={d.id}><th scope="row">{d.title}</th><td>{d.data}</td><td>{d.purpose}</td><td>{d.legalBasis}</td><td>{d.retention}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Com quem compartilhamos</h2>
      <p>Empresas das vagas em que você se candidata veem seu perfil profissional e seu nome abreviado. O contato só é compartilhado entre as duas partes de um turno confirmado, e somente para combinar esse trabalho. Fornecedores de infraestrutura e de envio de e-mail, quando contratados, atuarão como operadores, sob contrato. Autoridades recebem dados apenas mediante ordem legal.</p>

      <h2>E-mails que enviamos</h2>
      <p>Enviamos códigos de confirmação e recuperação de senha e avisos sobre ações sensíveis na sua conta, como troca de senha, tentativas de acesso e exportação de dados. Eles não dependem de consentimento porque protegem sua conta. Nossos e-mails não têm links e nunca pedimos sua senha. Novidades só são enviadas se você ativar essa opção. Cadastros não confirmados são apagados em até 24 horas.</p>

      <h2>Cookies</h2>
      <p>Usamos um único cookie, estritamente necessário, para manter você conectado com segurança. Ele não rastreia nada fora do app, por isso não exibimos banner de cookies. As fontes do app são hospedadas por nós, sem chamadas a serviços de terceiros.</p>

      <h2>Seus direitos (art. 18 da LGPD)</h2>
      <p>Você pode confirmar se tratamos seus dados, acessá-los, corrigi-los, levá-los para outro serviço, revogar consentimentos, pedir anonimização ou exclusão e saber com quem foram compartilhados. A maior parte disso está em <b>Perfil → Privacidade e segurança</b>. Para o restante, fale com o encarregado. Você também pode peticionar à Autoridade Nacional de Proteção de Dados (ANPD).</p>

      <h2>Como protegemos</h2>
      <p>Dados pessoais ficam criptografados no banco, senhas são guardadas apenas como hash, o acesso é restrito a quem tem relação com cada turno e cada acesso a perfil ou contato fica registrado. Em caso de incidente com risco relevante, comunicaremos você e a ANPD nos termos da lei.</p>

      <h2>Idade mínima</h2>
      <p>A plataforma é exclusiva para maiores de 18 anos, porque envolve trabalho noturno e serviço de bebidas alcoólicas.</p>

      <h2>Relação de trabalho</h2>
      <p>A plataforma aproxima as partes. As condições, a forma de contratação e os pagamentos são combinados diretamente entre empresa e freelancer, que respondem por suas obrigações legais.</p>
    </article>
  );
}
