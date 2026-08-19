// Turning a deadline into words a stressed student can read at a
// glance. Kept separate from any page so both the project page and the
// projects list say exactly the same thing.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long is left, in plain language. Rounds down deliberately: "2
 * days left" when it's 2 days and 23 hours is a kinder error than
 * saying 3 and having it disappear a day early.
 */
export function timeLeftInWords(deadline: string, now = new Date()): string {
  const remaining = new Date(deadline).getTime() - now.getTime();

  if (remaining <= 0) {
    return "Closed";
  }

  if (remaining < HOUR) {
    const minutes = Math.max(1, Math.floor(remaining / MINUTE));
    return `${minutes} minute${minutes === 1 ? "" : "s"} left`;
  }

  if (remaining < DAY) {
    const hours = Math.floor(remaining / HOUR);
    return `${hours} hour${hours === 1 ? "" : "s"} left`;
  }

  const days = Math.floor(remaining / DAY);
  return `${days} day${days === 1 ? "" : "s"} left`;
}

/** True when it's close enough that the wording should look urgent. */
export function isDueSoon(deadline: string, now = new Date()): boolean {
  const remaining = new Date(deadline).getTime() - now.getTime();
  return remaining > 0 && remaining < DAY;
}

export function formatDeadline(deadline: string): string {
  return new Date(deadline).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
