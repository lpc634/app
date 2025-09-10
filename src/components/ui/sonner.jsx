import { Toaster as Sonner } from "sonner";

const Toaster = (props) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group pointer-events-none fixed top-3 inset-x-0 z-[1000] flex justify-center"
      toastOptions={{
        classNames: {
          toast:
            "pointer-events-auto group toast group-[.toaster]:bg-v3-bg-card group-[.toaster]:text-v3-text-light group-[.toaster]:border-v3-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-v3-text-muted",
          actionButton:
            "group-[.toast]:bg-v3-orange group-[.toast]:text-white",
          cancelButton:
            "group-[.toast]:bg-v3-bg-dark group-[.toast]:text-v3-text-lightest",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };