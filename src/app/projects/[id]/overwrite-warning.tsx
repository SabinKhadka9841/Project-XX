import type { OverwriteRisk } from "@/modules/diffing";

/**
 * Shown wherever someone is about to add a copy into the final and
 * doing so would revert a teammate's work.
 *
 * Names the files plainly and says what will happen. It doesn't block:
 * sometimes replacing is exactly what's wanted, and the person looking
 * at it knows their group better than we do.
 */
export function OverwriteWarning({
  risk,
  viewerEmail,
  tone = "full",
}: {
  risk: OverwriteRisk;
  /** Used to avoid describing your own earlier work as somebody else's. */
  viewerEmail?: string | null;
  tone?: "full" | "short";
}) {
  if (risk.filenames.length === 0) {
    return null;
  }

  const files = risk.filenames.join(", ");
  const one = risk.filenames.length === 1;

  // When the only person who moved the final is you — which happens
  // constantly in solo mode, and whenever you made two copies — calling
  // it "their changes" is just wrong.
  const others = risk.peopleWhoChangedIt.filter(
    (email) => email.toLowerCase() !== (viewerEmail ?? "").toLowerCase(),
  );
  const onlyYou = risk.peopleWhoChangedIt.length > 0 && others.length === 0;
  const who = others.length > 0 ? others.join(" and ") : "someone else";

  if (tone === "short") {
    return (
      <p className="text-xs text-danger">
        Heads up: this would undo{" "}
        {onlyYou ? "newer changes already" : `${who}'s changes`} in the final
        to {files}.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-card border border-danger-border bg-danger-soft p-4">
      <p className="text-sm font-medium text-danger">
        {onlyYou
          ? one
            ? "This file has moved on since you branched it"
            : "These files have moved on since you branched them"
          : one
            ? "You both changed the same file"
            : "You both changed the same files"}
      </p>
      <p className="text-sm leading-relaxed text-danger">
        {onlyYou ? (
          <>
            <span className="font-medium">{files}</span> changed in the final
            after you made this branch. Adding this in will put your older
            version back, undoing {one ? "that change" : "those changes"}.
          </>
        ) : (
          <>
            {who} changed <span className="font-medium">{files}</span> in the
            final after you made this branch. Adding yours in will replace{" "}
            {one ? "it" : "them"} with your version, and their changes to{" "}
            {one ? "that file" : "those files"} will be gone.
          </>
        )}
      </p>
      <p className="text-sm leading-relaxed text-danger">
        {onlyYou
          ? "If the newer version is the one you want, ignore this branch rather than adding it in."
          : "If you both did real work, open the final's version, put the missing bits into your branch first, then ask again."}
      </p>
    </div>
  );
}
