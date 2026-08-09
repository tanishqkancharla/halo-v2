import {
  Button,
  Flex,
  H1,
  P,
  backgroundColor,
  colors,
  radius,
  shadow,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";

type OnboardingProps = {
  message?: string;
  isChoosing: boolean;
  onChoose: () => void;
};

export function Onboarding(props: OnboardingProps) {
  const shell = useStyles(styles.shell);
  const card = useStyles(styles.card);
  const error = useStyles(styles.error);

  return (
    <main className={shell}>
      <section className={card}>
        <Flex column gap={8}>
          <div>
            <H1>Choose a workspace</H1>
            <P>Pick the folder where Halo and Pi should work.</P>
          </div>
          {props.message && (
            <div className={error} role="alert">
              {props.message}
            </div>
          )}
          <Button onClick={props.onChoose} disabled={props.isChoosing}>
            {props.isChoosing ? "Choosing…" : "Choose workspace"}
          </Button>
        </Flex>
      </section>
    </main>
  );
}

const styles = {
  shell: style(spacing.padding({ all: 12 }), {
    display: "grid",
    placeItems: "center",
    minHeight: "100vh",
    backgroundColor: colors.gray[2],
  }),
  card: style(shadow.subtle, radius.lg, spacing.padding({ all: 12 }), {
    width: "min(100%, 440px)",
    minWidth: 0,
    backgroundColor: backgroundColor.element,
  }),
  error: style(text("xs", 500, "highContrast"), spacing.padding({ all: 4 }), {
    color: "light-dark(#b42318, #ff9592)",
    backgroundColor: "light-dark(#ffebe9, #3b1219)",
  }),
};
