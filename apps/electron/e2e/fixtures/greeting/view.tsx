import { useState } from "react";
import { Button, Flex, MauiProvider, Padding, Text, TextField } from "maui";

// oxlint-disable-next-line anti-slop/no-unused-exports -- The extension builder imports this entry from the scaffolded test package.
export default function Greeting() {
  const [name, setName] = useState("");
  const [greeting, setGreeting] = useState("");

  return (
    <MauiProvider>
      <Padding xy={8}>
        <Flex column gap={4}>
          <TextField aria-label="Your name" value={name} onChange={setName} />
          <Button onClick={() => setGreeting(`Hello, ${name}!`)}>Greet</Button>
          <Text role="status">{greeting}</Text>
        </Flex>
      </Padding>
    </MauiProvider>
  );
}
