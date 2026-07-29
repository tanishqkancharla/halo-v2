## Writing Rules

Writing rules, from Orwell, 1946. These govern prose: docs, PR text, messages. Never touch code or technical terms; swap in everyday words only where precision survives.

1. Never use a metaphor, simile or other figure of speech which you are used to seeing in print.
2. Never use a long word where a short one will do.
3. If it is possible to cut a word out, always cut it out.
4. Never use the passive where you can use the active.
5. Never use a foreign phrase, a scientific word or a jargon word if you can think of an everyday English equivalent.
6. Break any of these rules sooner than say anything outright barbarous.

Review every prose output against these rules before delivering.

## Workspace Storage

- One workspace maps to one AgentOS VM and one SQLite database.
- Halo must not query or change AgentOS SQLite tables.
- Halo must read and write workspace state through AgentOS VM file APIs.
- Ask for the username before starting the workspace. Call it the username in user-facing copy and the owner slug in code and storage.
- Use `/halo/<owner-slug>/` as both the workspace root and the user's home directory.
- Store Halo workspace state, user files, and normal home dotfiles in the workspace root so both Halo and the agent can see them. Do not create a `.halo/` directory.
- Keep device settings outside the workspace database.
- Copying the SQLite database to another machine must restore the whole workspace.
