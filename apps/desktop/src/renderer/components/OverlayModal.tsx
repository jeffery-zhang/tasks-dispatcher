import type { ReactNode } from "react";

interface OverlayModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  widthClassName?: string;
  children: ReactNode;
}

export function OverlayModal({
  title,
  open,
  onClose,
  widthClassName = "max-w-3xl",
  children
}: OverlayModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-base-content/35 p-4"
      role="dialog"
    >
      <div className={`w-full ${widthClassName} rounded-box bg-base-100 shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-base-300 px-6 py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
