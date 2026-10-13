import { useT } from '../../i18n';
import { Logo } from '../../ui/Logo';

const REPO = 'https://github.com/SpaceEngineerSS/helioshield';

export function Footer() {
  const t = useT();
  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__brand">
          <Logo size={22} />
          <span className="num">HelioShield {t.footer.version(__APP_VERSION__)}</span>
        </div>
        <p className="footer__disclaimer">{t.footer.disclaimer}</p>
        <p className="footer__credits">
          <span className="label">{t.footer.data}</span> NOAA SWPC · NASA CCMC DONKI · NASA GSFC SPDF OMNI · GFZ Potsdam
        </p>
        <nav className="footer__links">
          <a href={`${REPO}#readme`}>{t.footer.docs}</a>
          <a href={REPO}>{t.footer.source}</a>
          <a href="https://www.swpc.noaa.gov/">NOAA SWPC</a>
        </nav>
      </div>
    </footer>
  );
}
