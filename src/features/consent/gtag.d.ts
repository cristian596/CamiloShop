/** Set by the gtag bootstrap once the visitor accepts analytics. */
interface Window {
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
}
