import { isNative } from '../../lib/native';
import { useBrowser } from '../../state/browser';
import { Segmented, opts } from '../ui/Segmented';
import { vpnTone } from '../chrome/Toolbar';

export function VpnPanel() {
  const b = useBrowser();
  const v = b.vpn;
  const tone = vpnTone(v.status);
  // The desktop build has no VPN provider yet: never claim protection.
  const headline = isNative
    ? 'Not set up'
    : v.status === 'on' ? 'Protected · ' + v.regionName : v.status === 'connecting' ? 'Connecting to ' + v.regionName + '…' : 'Not connected';
  const sub = isNative
    ? 'No VPN provider is configured, so your traffic is not protected. WireGuard import is coming.'
    : v.status === 'on' && v.tunnel
      ? `Tunnel up · handshake ${v.tunnel.handshake} · exit IP ${v.tunnel.exitIp}`
      : v.status === 'connecting'
        ? 'Negotiating WireGuard handshake'
        : 'Browser traffic uses your normal connection.';
  const checks =
    v.status === 'on'
      ? b.services.vpn.leakChecks()
      : ['DNS', 'IPv6', 'WebRTC'].map((name) => ({ name, result: 'Not tested', ok: false }));

  return (
    <div className="panel-body">
      <div className="card vpn-hero">
        <div className="vpn-ring" style={{ color: tone }} aria-hidden="true">
          <span />
        </div>
        <div className="vpn-headline" role="status">
          {headline}
        </div>
        <div className="vpn-sub">{sub}</div>
        <button
          type="button"
          className={v.status === 'off' ? 'vpn-btn primary' : 'vpn-btn'}
          disabled={isNative}
          onClick={v.toggle}
        >
          {isNative ? 'Connect' : v.status === 'off' ? 'Connect' : v.status === 'connecting' ? 'Cancel' : 'Disconnect'}
        </button>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <div className="caps">Protect</div>
        <Segmented
          variant="fill"
          label="Protect"
          options={opts([['browser', 'Zenvora only'], ['device', 'Entire device']])}
          value={v.scope}
          onChange={v.setScope}
        />
        <div className="note">
          {v.scope === 'browser'
            ? "Only Zenvora's traffic goes through the tunnel. Other apps are not protected."
            : 'Needs the Zenvora network helper (one-time admin install). Covers all apps on this device.'}
        </div>
      </div>
      <div className="stack" style={{ gap: 4 }}>
        <div className="caps" style={{ paddingBottom: 4 }}>
          Region
        </div>
        {b.services.vpn.regions.map((r) => (
          <button
            key={r.code}
            type="button"
            className={v.region === r.code ? 'region on' : 'region'}
            aria-pressed={v.region === r.code}
            disabled={isNative}
            onClick={() => v.setRegion(r.code)}
          >
            <span className="code">{r.code}</span>
            <span className="name">{r.name}</span>
            <span className="ms">{r.latencyMs} ms</span>
          </button>
        ))}
      </div>
      <div className="card kv-card">
        <strong>Leak checks</strong>
        {checks.map((c) => (
          <div key={c.name} className="kv">
            <span>{c.name}</span>
            <span className={c.ok ? 'c-ok' : 'c-ink3'}>{c.result}</span>
          </div>
        ))}
      </div>
      <div className="note">WireGuard · config imported from your provider. Zenvora doesn't run its own VPN servers.</div>
    </div>
  );
}
