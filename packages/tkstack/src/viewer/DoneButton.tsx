import { Button, background, colors, iconSizeValues, text } from "maui";
import { style, useStyles } from "purse-styles";
import { Check } from "./Check.tsx";

const checkIcon = style({
  width: iconSizeValues.sm,
  height: iconSizeValues.sm,
});

export function DoneButton(props: { onClick?: () => void }) {
  const checkClass = useStyles(checkIcon);
  const primaryClass = useStyles(primaryButtonClass);
  return (
    <Button className={primaryClass} onClick={props.onClick}>
      <Check className={checkClass} />
      Done
    </Button>
  );
}

const primaryButtonClass = style(
  background.accent,
  text("xs", 400, "onAccent"),
  {
    "&:hover": {
      backgroundColor: colors.accent[10],
    },
    "&:active": {
      backgroundColor: colors.accent[11],
    },
  },
);
