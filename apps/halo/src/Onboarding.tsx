import { type FormEvent, useState } from "react";
import {
  Button,
  Flex,
  H1,
  P,
  TextField,
  backgroundColor,
  colors,
  radius,
  shadow,
  spacing,
  text,
} from "maui";
import { style, useStyles } from "purse-styles";

type OnboardingProps =
  | { status: "loading" }
  | {
      status: "start";
      ownerSlug: string;
      message?: string;
      isStarting: boolean;
      onStart: (ownerSlug: string) => void;
      onChange: () => void;
    };

export function Onboarding(props: OnboardingProps) {
  const shell = useStyles(styles.shell);
  const card = useStyles(styles.card);

  if (props.status === "loading") {
    return (
      <main className={shell}>
        <section className={card} aria-live="polite">
          <H1>Opening workspace</H1>
          <P>Checking this device for your last username…</P>
        </section>
      </main>
    );
  }

  return <WorkspaceForm {...props} shell={shell} card={card} />;
}

function WorkspaceForm({
  ownerSlug: initialOwnerSlug,
  message,
  isStarting,
  onStart,
  onChange,
  shell,
  card,
}: Extract<OnboardingProps, { status: "start" }> & {
  shell: string;
  card: string;
}) {
  const [ownerSlug, setOwnerSlug] = useState(initialOwnerSlug);
  const label = useStyles(styles.label);
  const error = useStyles(styles.error);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onStart(ownerSlug);
  }

  return (
    <main className={shell}>
      <section className={card}>
        <form onSubmit={submit}>
          <Flex column gap={8}>
            <div>
              <H1>Start workspace</H1>
              <P>Enter a username to open your workspace.</P>
            </div>
            <div>
              <label className={label} htmlFor="username">
                Username
              </label>
              <TextField
                id="username"
                value={ownerSlug}
                onChange={(value) => {
                  setOwnerSlug(value);
                  onChange();
                }}
                placeholder="tanishq"
                autoFocus
                isDisabled={isStarting}
                aria-describedby={message ? "username-error" : undefined}
                isInvalid={Boolean(message)}
              />
              {message && (
                <div className={error} id="username-error" role="alert">
                  {message}
                </div>
              )}
            </div>
            <Button type="submit" disabled={isStarting}>
              {isStarting ? "Starting…" : "Start workspace"}
            </Button>
          </Flex>
        </form>
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
  label: style(text("xs", 500, "lowContrast"), {
    display: "block",
    marginBottom: spacing.value(2),
  }),
  error: style(text("xs", 500, "highContrast"), spacing.padding({ all: 4 }), {
    color: "light-dark(#b42318, #ff9592)",
    backgroundColor: "light-dark(#ffebe9, #3b1219)",
  }),
};
