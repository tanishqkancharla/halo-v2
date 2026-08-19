import {
  Flex,
  H1,
  Route,
  SidebarItem,
  SidebarSection,
  Switch,
} from "@halo/plugin-sdk/view";

export function Sidebar() {
  return (
    <SidebarSection label="Calendar">
      <SidebarItem href="/">Month</SidebarItem>
    </SidebarSection>
  );
}

export function Routes() {
  return (
    <Switch>
      <Route path="/" component={MonthView} />
    </Switch>
  );
}

function MonthView() {
  const label = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(new Date());
  return (
    <div data-testid="calendar-month">
      <Flex column gap={4}>
        <H1>{label}</H1>
      </Flex>
    </div>
  );
}
