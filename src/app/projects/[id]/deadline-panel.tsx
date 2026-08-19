import {
  formatDeadline,
  isDueSoon,
  timeLeftInWords,
} from "@/modules/projects/deadline-wording";
import { updateDeadline } from "./actions";

/**
 * Turns an ISO timestamp into the value a datetime-local input wants
 * (YYYY-MM-DDTHH:mm in local time, no timezone suffix).
 */
function toInputValue(iso: string) {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function DeadlinePanel({
  projectId,
  deadline,
  isLocked,
  pendingCount,
}: {
  projectId: string;
  deadline: string | null;
  isLocked: boolean;
  pendingCount: number;
}) {
  const soon = deadline !== null && isDueSoon(deadline);

  return (
    <section className="flex flex-col gap-3 border-t pt-6">
      <h2 className="font-medium">Due date</h2>

      {deadline === null ? (
        <p className="text-sm text-zinc-600">
          No due date set. Add one and the final locks itself once it
          passes, so nothing changes after you&apos;ve handed it in.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-sm">
            {formatDeadline(deadline)}{" "}
            <span
              className={
                isLocked
                  ? "text-zinc-500"
                  : soon
                    ? "font-medium text-red-600"
                    : "text-zinc-600"
              }
            >
              — {timeLeftInWords(deadline)}
            </span>
          </p>

          {isLocked ? (
            <p className="text-sm text-zinc-600">
              This is closed. The final can&apos;t be changed any more, and
              nothing new can be added in. Copies still work if you want to
              keep tinkering.
            </p>
          ) : (
            pendingCount > 0 && (
              <p className="text-sm text-red-600">
                {pendingCount === 1
                  ? "1 change is still waiting for someone to say yes."
                  : `${pendingCount} changes are still waiting for someone to say yes.`}{" "}
                They won&apos;t be in the final unless somebody adds them in
                before the due date.
              </p>
            )
          )}
        </div>
      )}

      <form
        action={updateDeadline.bind(null, projectId)}
        className="flex flex-wrap items-center gap-2"
      >
        <input
          type="datetime-local"
          name="deadline"
          defaultValue={deadline ? toInputValue(deadline) : ""}
          className="rounded border px-2 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded border px-3 py-2 text-sm hover:bg-zinc-50"
        >
          {deadline ? "Change" : "Set due date"}
        </button>
        {deadline && (
          <button
            type="submit"
            name="deadline"
            value=""
            className="-my-1 py-2 text-sm text-zinc-600 underline"
          >
            Remove
          </button>
        )}
      </form>
    </section>
  );
}
