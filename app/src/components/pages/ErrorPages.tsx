import { hostOf } from '../../lib/url';
import { useBrowser } from '../../state/browser';

export function DnsErrorPage() {
  const b = useBrowser();
  const host = hostOf(b.cur.url);
  const err = b.cur.error;
  const notFound = !err || err.kind === 'dns';
  return (
    <div className="err">
      <div className="err-inner">
        <div className="err-icon" />
        <div className="err-kicker">Can't reach this site</div>
        <h1 className="err-title">{notFound ? `${host} could not be found` : `${host} can't be reached`}</h1>
        <p className="err-body">
          {notFound
            ? 'Zenvora looked up the address, but no server answered for that name. The address may be misspelled, or the site may no longer exist.'
            : 'Zenvora found the site, but the connection failed before the page loaded.'}
        </p>
        <div className="err-tips">
          <span>· Check the address for typos</span>
          <span>· Check your network connection</span>
          <span>· If VPN is on, try another region</span>
        </div>
        <div className="err-actions">
          <button type="button" className="btn primary" onClick={b.reload}>
            Try again
          </button>
          <button type="button" className="btn" onClick={() => b.navigate(host.split('.')[0])}>
            Search for “{host}”
          </button>
        </div>
        <div className="err-code">
          {err ? `${err.desc} · error ${err.code}` : 'ERR_NAME_NOT_RESOLVED · resolver 1.1.1.1 (DNS-over-HTTPS) · 38 ms'}
        </div>
      </div>
    </div>
  );
}

export function CertErrorPage() {
  const b = useBrowser();
  const host = hostOf(b.cur.url);
  const err = b.cur.error;
  return (
    <div className="err">
      <div className="err-inner">
        <div className="err-icon danger" />
        <div className="err-kicker danger">Connection not private</div>
        <h1 className="err-title">Your connection to {host} isn't private</h1>
        <p className="err-body">
          {err ? "This site's security certificate isn't valid." : "This site's security certificate has expired."}{' '}
          Someone could be trying to read what you send — passwords, messages or card details. Zenvora stopped the page
          from loading.
        </p>
        <div className="err-actions">
          <button type="button" className="btn primary" onClick={() => b.go(-1)}>
            Back to safety
          </button>
          <button
            type="button"
            className="btn"
            aria-expanded={b.certDetails}
            onClick={() => b.setCertDetails(!b.certDetails)}
          >
            Certificate details
          </button>
        </div>
        {b.certDetails && (
          <div className="cert-details">
            {err ? (
              <div className="mono">
                {err.desc}
                <br />
                Host: {host} · error {err.code}
              </div>
            ) : (
              <div className="mono">
                NET::ERR_CERT_DATE_INVALID
                <br />
                Subject: *.{host.replace(/^expired\./, '')}
                <br />
                Issuer: COMODO RSA Domain Validation CA
                <br />
                Expired: Apr 12, 2015 · 11 years ago
              </div>
            )}
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                b.setCertDetails(false);
                b.allowInsecure(b.cur.id, host);
              }}
            >
              Continue to {host} (unsafe)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
