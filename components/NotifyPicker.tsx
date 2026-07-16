/**
 * Basecamp-style "Notify" picker (RIM_GoogleWorkspace.md, notifications).
 * Default is No one — nothing is emailed unless the poster deliberately picks
 * people. Used by the comment compose and the file "Notify the Space" action.
 * Controlled: the parent owns the value and includes it in its POST.
 *
 * CSS prefix: gf-notify-
 */

"use client";

export type NotifyValue = {
  mode: "none" | "everyone" | "people";
  userIds: string[];
};

export const NOTIFY_NONE: NotifyValue = { mode: "none", userIds: [] };

interface Member {
  id: string;
  name: string;
}

export default function NotifyPicker({
  members,
  value,
  onChange,
  disabled,
}: {
  members: Member[];
  value: NotifyValue;
  onChange: (v: NotifyValue) => void;
  disabled?: boolean;
}) {
  function toggle(id: string) {
    const has = value.userIds.includes(id);
    onChange({
      mode: "people",
      userIds: has ? value.userIds.filter((x) => x !== id) : [...value.userIds, id],
    });
  }

  return (
    <div className="gf-notify">
      <label className="gf-notify__label">
        Notify
        <select
          className="gf-notify__select"
          value={value.mode}
          disabled={disabled}
          onChange={(e) => {
            const mode = e.target.value as NotifyValue["mode"];
            onChange({ mode, userIds: mode === "people" ? value.userIds : [] });
          }}
        >
          <option value="none">No one</option>
          <option value="everyone">Everyone in the Space</option>
          <option value="people">Choose people…</option>
        </select>
      </label>

      {value.mode === "people" && (
        <ul className="gf-notify__people" role="group" aria-label="Choose who to notify">
          {members.length === 0 ? (
            <li className="gf-notify__empty">No one else is in this Space yet.</li>
          ) : (
            members.map((m) => (
              <li key={m.id}>
                <label className="gf-notify__person">
                  <input
                    type="checkbox"
                    checked={value.userIds.includes(m.id)}
                    onChange={() => toggle(m.id)}
                    disabled={disabled}
                  />
                  {m.name}
                </label>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
