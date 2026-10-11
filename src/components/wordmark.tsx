/** Text placeholder for the logo until public/brand/ assets are final. Brand names must not be auto-translated. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className} translate="no">
      <span className="sr-only">Gearage</span>
      <span aria-hidden="true">
        GEAR<span className="text-brand">AGE</span>
      </span>
    </span>
  );
}
