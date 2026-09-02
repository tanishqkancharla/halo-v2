function functionTag(args: { value: unknown }) {
  return {}.toString.call(args.value);
}

/** True for ordinary and async functions. Used where both `typeof` and `instanceof Function` are banned. */
export function isCallable(args: { value: unknown }) {
  const tag = functionTag({ value: args.value });
  return tag === "[object Function]" || tag === "[object AsyncFunction]";
}
