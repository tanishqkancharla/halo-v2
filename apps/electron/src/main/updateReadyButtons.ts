/** Later on the left, Update on the right as the default button. */
export function updateReadyButtonLayout(platform: NodeJS.Platform) {
  // macOS draws the first button on the right as the default action.
  if (platform === "darwin") {
    return {
      buttons: ["Update", "Later"] as const,
      updateIndex: 0,
      laterIndex: 1,
    };
  }
  return {
    buttons: ["Later", "Update"] as const,
    updateIndex: 1,
    laterIndex: 0,
  };
}
