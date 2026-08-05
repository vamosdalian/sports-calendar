import { Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

type DesktopSubscribeQrProps = {
  scanLabel: string;
  subscriptionUrl: string;
  triggerLabel: string;
};

/**
 * Desktop hand-off for subscribing on a phone. The QR code carries the same
 * webcal URL as the page's subscribe button, so scanning opens the calendar
 * subscription flow directly.
 */
export function DesktopSubscribeQr({ scanLabel, subscriptionUrl, triggerLabel }: DesktopSubscribeQrProps) {
  return (
    <aside
      aria-label={triggerLabel}
      className="group fixed right-0 top-1/2 z-30 hidden -translate-y-1/2 lg:block"
    >
      <div
        id="desktop-subscribe-qr"
        className="pointer-events-none absolute right-0 top-1/2 w-56 translate-x-full -translate-y-1/2 bg-white p-4 opacity-0 shadow-[0_18px_45px_rgba(16,33,50,0.2)] transition duration-300 ease-out group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-x-0 group-focus-within:opacity-100 motion-reduce:transition-none"
      >
        <QRCodeSVG
          className="block h-auto w-full"
          level="M"
          marginSize={2}
          size={192}
          title={scanLabel}
          value={subscriptionUrl}
        />
        <p className="mt-3 text-center text-sm font-medium text-ink/75">{scanLabel}</p>
      </div>

      <button
        type="button"
        aria-controls="desktop-subscribe-qr"
        aria-label={triggerLabel}
        className="relative inline-flex size-14 items-center justify-center bg-header text-white shadow-[0_12px_30px_rgba(16,33,50,0.22)] transition hover:bg-header/90 group-hover:opacity-0 group-focus-within:opacity-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-header motion-reduce:transition-none"
      >
        <Smartphone aria-hidden="true" className="size-6" strokeWidth={1.8} />
      </button>
    </aside>
  );
}
