// Renders a message with **bold** parts. No HTML parsing, so nothing can be injected.
export function Rich({ text }: { text: string }) {
  return <>{text.split('**').map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))}</>;
}
