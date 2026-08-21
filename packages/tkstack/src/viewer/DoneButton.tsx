import { Button, icon } from "maui";
import { useStyles } from "purse-styles";
import { Check } from "./Check.tsx";

export function DoneButton(props: {
  onClick?: () => void;
  variant?: "default" | "quiet";
}) {
  const checkClass = useStyles(icon("sm"));
  return (
    <Button variant={props.variant} onClick={props.onClick}>
      <Check className={checkClass} />
      Done
    </Button>
  );
}
