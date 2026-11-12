export const resources = import.meta.glob<Record<string, string>>("./*.json", {
  eager: true,
  import: "default",
});
