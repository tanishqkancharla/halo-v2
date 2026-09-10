# Source annotations

Click a linked stack line to inspect its source changes. Use Tab and Enter to navigate with the keyboard.

## Validate before saving

```callstack
 handleRequest
-├── saveUnchecked  # accepted invalid input [[request:old:12]]
+├── validateInput  # reject empty names [[request:new:12-13]] [[validation:new:1-3]]
 └── saveRecord  # store validated input [[request:new:14]]
```

Validation now runs before persistence. The unchanged `saveRecord` call links to context in the same patch. Select either linked change above the source viewer to follow validation into another file.

```source-diff:request:src/request.ts
diff --git a/src/request.ts b/src/request.ts
--- a/src/request.ts
+++ b/src/request.ts
@@ -10,5 +10,6 @@
 export function handleRequest(input: Input) {
   const record = input.record;
-  saveUnchecked(record);
+  const error = validateInput(record);
+  if (error instanceof Error) return error;
   return saveRecord(record);
 }
```

```source-diff:validation:src/validation.ts
diff --git a/src/validation.ts b/src/validation.ts
new file mode 100644
--- /dev/null
+++ b/src/validation.ts
@@ -0,0 +1,3 @@
+export function validateInput(record: Record) {
+  if (record.name.length === 0) return new InvalidNameError();
+}
```

## Plain stacks still work

```callstack
 application
 └── render
```
