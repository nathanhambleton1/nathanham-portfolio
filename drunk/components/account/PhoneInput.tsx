import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Input } from "../ui/input";
import { formatPhoneInput } from "../../lib/phone";

type Props = Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: string;
  onChange: (formatted: string) => void;
};

/**
 * A US phone field that formats as you type — "(555) 123-4567" — so the
 * number always comes out the same however it was typed or pasted.
 */
const PhoneInput = forwardRef<HTMLInputElement, Props>(({ value, onChange, className, ...rest }, ref) => (
  <div className="relative">
    <span
      aria-hidden
      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none font-mono text-sm text-muted-foreground"
    >
      +1
    </span>
    <Input
      ref={ref}
      type="tel"
      inputMode="tel"
      autoComplete="tel-national"
      placeholder="(555) 123-4567"
      value={value}
      onChange={(e) => onChange(formatPhoneInput(e.target.value))}
      className={cn("h-12 pl-10 font-mono text-lg tracking-wide md:text-lg", className)}
      {...rest}
    />
  </div>
));
PhoneInput.displayName = "PhoneInput";

export default PhoneInput;
