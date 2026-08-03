export function Tag({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-edge bg-surface/70 backdrop-blur-sm px-3 py-1 font-mono text-xs text-ink-muted">
      {children}
    </span>
  );
}

export function TagRow({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item}>
          <Tag>{item}</Tag>
        </li>
      ))}
    </ul>
  );
}
