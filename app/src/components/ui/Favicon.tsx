import { faviconFor } from '../../lib/url';

export function Favicon({ url, large }: { url: string; large?: boolean }) {
  const f = faviconFor(url);
  return (
    <span className={large ? 'fav lg' : 'fav'} style={{ background: f.color }} aria-hidden="true">
      {f.letter}
    </span>
  );
}
