/**
 * Render a doctor's name with exactly one "Dr." prefix.
 *
 * Clinic records are entered by humans and arrive both ways — "Ramesh Rao" and
 * "Dr. Ramesh Rao" — so a component that unconditionally prepends "Dr." shows
 * "Dr. Dr. Ramesh Rao".
 *
 * The naive guard for this is `name.toLowerCase().startsWith("dr")`, which is
 * wrong in the other direction: it silently drops the title for anyone called
 * Drishti, Drew or Draupadi. Match the honorific as a whole token instead.
 */
const HONORIFIC = /^(dr|doctor)\.?(\s|$)/i;

export function formatDoctorName(
  name: string | null | undefined,
  fallback: string = "Doctor"
): string {
  const trimmed = (name || "").trim().replace(/\s+/g, " ");
  if (!trimmed) return fallback;
  if (HONORIFIC.test(trimmed)) {
    // Already titled. Normalise "Doctor Ramesh" / "dr Ramesh" to "Dr. Ramesh".
    return trimmed.replace(HONORIFIC, "Dr. ").replace(/\s+/g, " ").trim();
  }
  return `Dr. ${trimmed}`;
}
