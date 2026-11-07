import { toast } from "@/hooks/use-toast";

/**
 * Non-blocking stand-in for window.alert() in Drunkopoly. Shows the message as
 * a branded error toast (see DrunkToaster) instead of the browser's native box.
 */
export function drunkAlert(message: string, title = "Something went wrong") {
  try {
    toast({ title, description: message, variant: "destructive" });
  } catch {
    // Toast store should never throw, but never swallow the message entirely.
    window.alert(message);
  }
}
