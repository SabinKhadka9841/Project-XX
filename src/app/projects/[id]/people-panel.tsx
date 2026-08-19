import type { ExpectedTeammate, Member } from "@/modules/projects/members";
import { ExpectedTeammates } from "./expected-teammates";
import { InviteLink } from "./invite-link";

/**
 * Who's actually in the project.
 *
 * This exists because the metric that matters for a pilot is whether
 * *every* member of a group signed up — and until now there was no way
 * to see who had. You'd send a link into a group chat and have no idea
 * who acted on it, which makes chasing the last person impossible.
 */
export function PeoplePanel({
  projectId,
  projectName,
  members,
  expected,
  currentUserId,
}: {
  projectId: string;
  projectName: string;
  members: Member[];
  expected: ExpectedTeammate[];
  currentUserId: string;
}) {
  return (
    <section className="card flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium">
          People{members.length > 1 ? ` (${members.length})` : ""}
        </h2>
        <InviteLink projectId={projectId} projectName={projectName} />
      </div>

      <ul className="flex flex-col gap-1.5">
        {members.map((member) => (
          <li
            key={member.userId}
            className="flex items-baseline gap-1.5 text-sm"
          >
            <span className="min-w-0 truncate">{member.name}</span>
            {member.userId === currentUserId && (
              <span className="shrink-0 text-xs text-text-subtle">you</span>
            )}
            {member.role === "owner" && (
              <span
                className="shrink-0 rounded-full bg-surface-muted px-1.5 py-0.5 text-xs text-text-subtle"
                title="Started this project"
              >
                owner
              </span>
            )}
          </li>
        ))}
      </ul>

      {members.length === 1 && expected.length === 0 && (
        <p className="text-sm leading-relaxed text-text-muted">
          You&apos;re the only one here so far. Send the invite to your
          group — anyone who hasn&apos;t joined can&apos;t see the work, and
          won&apos;t show up in the record of who did what.
        </p>
      )}

      <div className="border-t border-border-subtle pt-3">
        <h3 className="mb-2 text-sm font-medium">Who you&apos;re expecting</h3>
        <ExpectedTeammates
          projectId={projectId}
          projectName={projectName}
          expected={expected}
        />
      </div>
    </section>
  );
}
