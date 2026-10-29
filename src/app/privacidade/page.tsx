import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de privacidade",
};

// Keep PRIVACY_VERSION in src/lib/account.ts in sync with the date below when this text changes.
export default function Page() {
  return (
    <main className="mx-auto w-full max-w-[68ch] px-4 py-10 text-[15.5px] leading-relaxed sm:py-14">
      <Link href="/" className="text-[14px] font-semibold text-action">
        ← Voltar
      </Link>
      <h1 className="mt-4 text-[28px] leading-tight font-extrabold tracking-tight">Política de privacidade</h1>
      <p className="mt-1 text-[14px] text-muted">Versão de 28 de outubro de 2026</p>

      <h2 className="mt-8 text-[18px] font-extrabold">O que guardamos</h2>
      <p className="mt-2">Só o necessário para mostrar oportunidades que servem pra você:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>e-mail, para entrar na conta;</li>
        <li>nome (opcional), curso e área, cidade e estado, nível de estudo e interesses;</li>
        <li>data de nascimento, usada só para checar idade mínima de programas (por exemplo, 16 ou 18 anos);</li>
        <li>as oportunidades que você salvou;</li>
        <li>a data em que você aceitou esta política;</li>
        <li>se você pediu o resumo semanal por e-mail, e desde quando.</li>
      </ul>
      <p className="mt-2">Não pedimos CPF, telefone nem endereço completo.</p>

      <h2 className="mt-8 text-[18px] font-extrabold">Para que usamos</h2>
      <p className="mt-2">
        Para montar a página com o que combina com o seu perfil e guardar seus salvos entre aparelhos. Não vendemos nem
        compartilhamos seus dados com terceiros para publicidade.
      </p>

      <h2 className="mt-8 text-[18px] font-extrabold">Resumo por e-mail</h2>
      <p className="mt-2">
        Só se você marcar a opção no seu perfil (ela começa desligada), mandamos toda segunda um e-mail com oportunidades
        novas que combinam com o seu perfil e os prazos dos seus salvos que fecham na semana. O e-mail sai de uma conta do
        Gmail do projeto, então passa pelos servidores do Google. Para parar, desmarque a opção no perfil ou use o link
        &quot;Parar de receber&quot; no fim de qualquer resumo.
      </p>

      <h2 className="mt-8 text-[18px] font-extrabold">Onde ficam</h2>
      <p className="mt-2">
        No banco de dados do Supabase, protegido para que cada pessoa só acesse o próprio perfil. Sem conta, o perfil fica
        apenas no seu navegador.
      </p>

      <h2 className="mt-8 text-[18px] font-extrabold">Seus direitos (LGPD)</h2>
      <p className="mt-2">
        Você pode ver e corrigir seus dados em &quot;Editar perfil&quot; e apagar a conta a qualquer momento em &quot;Apagar minha
        conta&quot;. Ao apagar, perfil e salvos são excluídos na hora.
      </p>

      <h2 className="mt-8 text-[18px] font-extrabold">Sobre as oportunidades</h2>
      <p className="mt-2">
        As informações vêm de páginas públicas e são conferidas com frequência, mas a fonte final é sempre a página oficial
        de cada oportunidade.
      </p>
    </main>
  );
}
