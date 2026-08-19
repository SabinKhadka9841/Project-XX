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
    <section className="flex flex-col gap-3 border-t pt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium">
          People{members.length > 1 ? ` (${members.length})` : ""}
        </h2>
        <InviteLink projectId={projectId} projectName={projectName} />
      </div>

      <ul className="flex flex-col gap-1">
        {members.map((member) => (
          <li key={member.userId} className="text-sm">
            {member.name}
            {member.userId === currentUserId && (
              <span className="text-zinc-500"> — you</span>
            )}
            {member.role === "owner" && (
              <span className="text-zinc-500"> · started this project</span>
            )}
          </li>
        ))}
      </ul>

      {members.length === 1 && expected.length === 0 && (
        <p className="text-sm text-zinc-600">
          You&apos;re the only one here so far. Send the invite to your
          group — anyone who hasn&apos;t joined can&apos;t see the work, and
          won&apos;t show up in the record of who did what.
        </p>
      )}

      <div className="border-t pt-3">
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
