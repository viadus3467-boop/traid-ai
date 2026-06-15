import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            type="button"
            className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 240 }}
            className="fixed inset-x-0 bottom-0 z-[60] mx-auto w-full max-w-[440px] rounded-t-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,16,27,0.98),rgba(7,9,15,0.98))] px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-18px_64px_rgba(0,0,0,0.45)]"
          >
            <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/15" />
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-white">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/10 bg-white/8 p-2 text-white/75"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[78vh] overflow-y-auto pb-2">{children}</div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
