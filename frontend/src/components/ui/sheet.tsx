import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { DialogClose, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Use the existing modal primitives for focus trapping, dismissal and scroll lock.
// Keep sidebar positioning/animation separate from the centered dialog styles.
const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed right-0 top-0 z-50 flex h-dvh w-[calc(100%-2rem)] max-w-sm flex-col border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
        className,
      )}
      {...props}
    >
      {children}
      <DialogClose asChild>
        <Button variant="ghost" size="icon" className="absolute right-3 top-3 h-11 w-11">
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </Button>
      </DialogClose>
    </DialogPrimitive.Content>
  </DialogPortal>
));
SheetContent.displayName = "SheetContent";

export { SheetContent };
