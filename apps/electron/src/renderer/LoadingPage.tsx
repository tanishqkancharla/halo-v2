import { colors } from "maui";
import { style, useStyles } from "purse-styles";
import { HaloLogo } from "./haloLogo/HaloLogo.tsx";

export function LoadingPage() {
  const shell = useStyles(styles.shell);
  const logo = useStyles(styles.logo);

  return (
    <main className={shell}>
      <div className={logo}>
        <HaloLogo />
      </div>
    </main>
  );
}

const styles = {
  shell: style({
    display: "grid",
    placeItems: "center",
    height: "100%",
    backgroundColor: colors.gray[2],
  }),
  logo: style({
    width: "14rem",
    height: "14rem",
  }),
};
