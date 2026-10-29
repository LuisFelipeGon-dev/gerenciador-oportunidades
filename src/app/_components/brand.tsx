import Link from "next/link";

// The Topa? wordmark (identidade/IDENTIDADE.md). The navy band is navy in both themes, so the
// white version is used there.

export function BrandLogo({ className = "h-7 w-auto" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- a small static SVG; next/image adds nothing here.
  return <img src="/brand/topa-wordmark-dark.svg" alt="Topa?" className={className} />;
}

/** The navy band with the logo, for the inner pages (Entrar, Ajustes, cancelar o resumo). */
export function SimpleHeader() {
  return (
    <div className="on-navy bg-navy text-white">
      <div className="mx-auto flex h-16 max-w-[1040px] items-center px-4 sm:px-5">
        <Link href="/" aria-label="Topa?, página inicial">
          <BrandLogo />
        </Link>
      </div>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-[1040px] flex-col gap-3 px-4 py-6 text-[13px] text-muted sm:flex-row sm:items-center sm:gap-6 sm:px-5">
        <p className="flex items-center gap-2 font-semibold text-ink">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand mark. */}
          <img src="/brand/topa-mark.svg" alt="" className="size-6 rounded-[22%]" />
          Topa?
        </p>
        <p className="max-w-[70ch] leading-relaxed">
          Coletado todo dia do Devpost, da MLH, dos GDGs, do dev.events, do Luma e de páginas oficiais conferidas à mão. O site
          nunca é a fonte final: confira as regras na página oficial.
        </p>
        <nav className="flex gap-4 sm:ml-auto" aria-label="Rodapé">
          <Link href="/ajustes" className="font-semibold hover:text-ink">
            Ajustes
          </Link>
          <Link href="/privacidade" className="font-semibold hover:text-ink">
            Privacidade
          </Link>
        </nav>
      </div>
    </footer>
  );
}
