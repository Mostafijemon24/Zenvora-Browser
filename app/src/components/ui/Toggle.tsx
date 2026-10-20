export function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={on ? 'toggle on' : 'toggle'} onClick={onClick}>
      <span />
    </button>
  );
}
