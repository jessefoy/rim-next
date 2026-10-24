"use client";

/** Where it appears: Category and Format (labels, never access), where the
 *  program is listed and why not, its order, and the hide options. One of the
 *  program editor's seven sections. */

import { memo, useMemo } from "react";
import Link from "next/link";
import {
  OFFERING_CATEGORIES,
  OFFERING_FORMATS,
  categorySectionTitle,
  formatRequiredFor,
} from "@/lib/programOffering";
import { DateTimePicker, EditorSection, listingReasonOf, type Category, type Setter } from "./shared";

interface Props {
  canManage: boolean;
  categories: Category[];
  categoryId: string;
  offeringFromLegacy: boolean;
  isArchived: boolean;
  offeringCategory: string;
  setOfferingCategory: Setter<string>;
  offeringFormat: string;
  setOfferingFormat: Setter<string>;
  silentMeditation: boolean;
  setSilentMeditation: Setter<boolean>;
  hostedByVolunteers: boolean;
  setHostedByVolunteers: Setter<boolean>;
  sortOrder: string;
  setSortOrder: Setter<string>;
  hideFromProgramPageList: boolean;
  setHideFromProgramPageList: Setter<boolean>;
  hideFromWeeklySchedule: boolean;
  setHideFromWeeklySchedule: Setter<boolean>;
  hideWhenPast: boolean;
  setHideWhenPast: Setter<boolean>;
  removeFromProgramList: boolean;
  setRemoveFromProgramList: Setter<boolean>;
  dashboardShowAt: string;
  setDashboardShowAt: Setter<string>;
  /** Read here, set under When and where and How people join. */
  openEntry: boolean;
  programFormat: string;
  recurrenceFreq: string;
  startDatetime: string;
  endDatetime: string;
  markDirty: () => void;
}

function AppearsSection({
  canManage, categories, categoryId, offeringFromLegacy, isArchived,
  offeringCategory, setOfferingCategory,
  offeringFormat, setOfferingFormat,
  silentMeditation, setSilentMeditation,
  hostedByVolunteers, setHostedByVolunteers,
  sortOrder, setSortOrder,
  hideFromProgramPageList, setHideFromProgramPageList,
  hideFromWeeklySchedule, setHideFromWeeklySchedule,
  hideWhenPast, setHideWhenPast,
  removeFromProgramList, setRemoveFromProgramList,
  dashboardShowAt, setDashboardShowAt,
  openEntry, programFormat, recurrenceFreq, startDatetime, endDatetime,
  markDirty,
}: Props) {
  const selectedCategory = categories.find((c) => c.id === categoryId);

  // ── "Where this program appears" ─────────────────────────────────────────
  // The public listing leaves a program out for reasons that live outside the
  // checkboxes (no category, a hidden category, a passed date, archived).
  // Mirror the rules in app/community-programs/page.tsx and
  // app/this-week/page.tsx so the editor says why, instead of the program
  // silently not appearing.
  // The rule is shared with Ready to be seen (listingReasonOf in ./shared).
  const listingReason = useMemo(
    () => listingReasonOf({
      isArchived, hideFromProgramPageList, offeringCategory,
      categoryHidden: !!selectedCategory?.hidden,
      hideWhenPast, recurrenceFreq, startDatetime, endDatetime,
    }),
    [isArchived, hideFromProgramPageList, offeringCategory, selectedCategory, hideWhenPast, recurrenceFreq, startDatetime, endDatetime],
  );
  // My Home (app/account/(authenticated)/dashboard/page.tsx): online programs
  // appear in Today on the days they meet, unless archived or hidden from the
  // member home (until an optional auto-show date). Who sees them follows the
  // Open entry setting: programs with open entry show to everyone; the others
  // show to registrants, hosts and teachers. In-person programs appear only for
  // their registrants. Waitlisted members don't get a Join.
  const homeHiddenUntilLater = useMemo(() => {
    if (!removeFromProgramList) return false;
    if (!dashboardShowAt) return true;
    // Both are Central wall-clock strings, so they compare as text.
    const nowCt = new Date()
      .toLocaleString("sv-SE", { timeZone: "America/Chicago" })
      .replace(" ", "T")
      .slice(0, 16);
    return dashboardShowAt.slice(0, 16) > nowCt;
  }, [removeFromProgramList, dashboardShowAt]);
  const homeState: "archived" | "hidden" | "hiddenUntil" | "noSchedule" | "inPerson" | "open" | "registrants" =
    isArchived ? "archived"
      : !startDatetime ? "noSchedule"
      // The hide box filters online sessions only; in-person registrants
      // still see their program on the day.
      : programFormat === "in-person" ? "inPerson"
      : homeHiddenUntilLater ? (dashboardShowAt ? "hiddenUntil" : "hidden")
      : openEntry ? "open"
      : "registrants";

  const weeklyReason: "archived" | "hiddenListing" | "hiddenWeekly" | "noSchedule" | null =
    isArchived ? "archived"
      : hideFromProgramPageList ? "hiddenListing"
      : hideFromWeeklySchedule ? "hiddenWeekly"
      : !startDatetime ? "noSchedule"
      : null;

  return (
    <EditorSection id="where">
      <div className="pe-form">
        <label className="pe-field">
          <span className="pe-field__label">Category *</span>
          <span className="pe-field__help">Which way this offering belongs to. Courses belong to Immersion; a drop-in offered as a series stays in Ongoing Learning &amp; Practice. Community groups and special events sit outside the three ways.</span>
          <select
            value={offeringCategory}
            onChange={(e) => {
              setOfferingCategory(e.target.value);
              markDirty();
            }}
            id="pe-offering-category"
            className="pe-select"
            aria-required="true"
          >
            <option value="">— Choose —</option>
            <optgroup label="The three ways">
              {OFFERING_CATEGORIES.filter((c) => c.way).map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </optgroup>
            <optgroup label="Outside the three ways">
              {OFFERING_CATEGORIES.filter((c) => c.code === "COMMUNITY_GROUP" || c.code === "SPECIAL_EVENT").map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </optgroup>
            <optgroup label="Internal">
              {OFFERING_CATEGORIES.filter((c) => c.code === "SERVICE" || c.code === "PRIVATE").map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </optgroup>
          </select>
          {offeringFromLegacy && (
            <span className="pe-field__help" style={{ marginTop: 6 }}>
              Filled in from this program&rsquo;s old category. Saving keeps it.
            </span>
          )}
        </label>

        <label className="pe-field">
          <span className="pe-field__label">
            Format{formatRequiredFor(offeringCategory) ? " *" : " (optional here)"}
          </span>
          <span className="pe-field__help">What kind of offering it is.</span>
          <select
            value={offeringFormat}
            onChange={(e) => {
              setOfferingFormat(e.target.value);
              // Silent meditation is a kind of drop-in; it only applies to one.
              if (e.target.value !== "DROP_IN") setSilentMeditation(false);
              markDirty();
            }}
            className="pe-select"
            aria-required={formatRequiredFor(offeringCategory) ? "true" : undefined}
          >
            <option value="">— Choose —</option>
            {OFFERING_FORMATS.map((f) => (
              <option key={f.code} value={f.code}>{f.label}</option>
            ))}
          </select>
        </label>

        {offeringFormat === "DROP_IN" && !openEntry && (
          <div className="pe-field">
            <span className="pe-field__help">Format is a label. For people to join this without registering, turn on Open entry under How people join.</span>
          </div>
        )}

        {offeringFormat === "DROP_IN" && (
          <div className="pe-field">
            <label className="pe-checkbox">
              <input
                type="checkbox"
                checked={silentMeditation}
                onChange={(e) => { setSilentMeditation(e.target.checked); markDirty(); }}
              />
              <span>Silent meditation</span>
            </label>
            <span className="pe-field__help">A silent sit. The programs page groups these under &ldquo;Silent meditation&rdquo; within Ongoing Learning &amp; Practice.</span>
          </div>
        )}

        <div className="pe-field">
          <label className="pe-checkbox">
            <input
              type="checkbox"
              checked={hostedByVolunteers}
              onChange={(e) => { setHostedByVolunteers(e.target.checked); markDirty(); }}
            />
            <span>Hosted by volunteers</span>
          </label>
          <span className="pe-field__help">Cards and pages carry the label &ldquo;Hosted by volunteers.&rdquo; Community groups are member-led by definition and do not need it.</span>
        </div>

        {categoryId && selectedCategory && (
          <div className="pe-field">
            <span className="pe-field__label">Old category</span>
            <span className="pe-field__help">
              {selectedCategory.name}. Being retired: the public pages no longer read it (only its &ldquo;hide from the Programs page&rdquo; setting still applies).
              {selectedCategory.kind ? <> Its kind was {selectedCategory.kind.toLowerCase().replace(/_/g, " ")}.</> : null}
            </span>
          </div>
        )}

        {/* Where this program appears: derived from every rule the two
            public pages apply, not only the checkboxes below. */}
        <div className="pe-readout" aria-live="polite">
          <p className="pe-readout__title">Where this program appears</p>
          <p className={`pe-readout__row${listingReason ? " pe-readout__row--off" : ""}`}>
            <span className="pe-readout__place">Programs &amp; Events page: </span>
            {listingReason === null && (
              <>Listed under {categorySectionTitle(offeringCategory)}.</>
            )}
            {listingReason === "archived" && (
              <><span className="pe-readout__state">Not listed.</span> Archived programs don&rsquo;t appear.</>
            )}
            {listingReason === "hidden" && (
              <><span className="pe-readout__state">Not listed.</span> The first box below is checked.</>
            )}
            {listingReason === "noCategory" && (
              <>
                <span className="pe-readout__state">Not listed.</span> It needs a Category to appear under.{" "}
                {/* An inline link, not a <button>: the app shells give every
                    button a 44px box, which would break the sentence. */}
                <a
                  href="#"
                  className="pe-readout__link"
                  onClick={(e) => { e.preventDefault(); document.getElementById("pe-offering-category")?.focus(); }}
                >
                  Choose one above
                </a>.
              </>
            )}
            {listingReason === "private" && (
              <><span className="pe-readout__state">Not listed.</span> A Private program is never listed.</>
            )}
            {listingReason === "hiddenCategory" && (
              <>
                <span className="pe-readout__state">Not listed.</span> Its category, {selectedCategory?.name}, is hidden from the public page.{" "}
                {canManage ? (
                  <>You can change that on the{" "}
                  <Link href="/tools/programs/categories" className="pe-readout__link">Program Categories</Link> page.</>
                ) : (
                  <>The registrar or an admin can change that.</>
                )}
              </>
            )}
            {listingReason === "past" && (
              <><span className="pe-readout__state">Not listed.</span> Its date has passed. To keep it listed, uncheck &ldquo;Hide automatically after the date passes&rdquo; below.</>
            )}
          </p>
          <p className={`pe-readout__row${weeklyReason ? " pe-readout__row--off" : ""}`}>
            <span className="pe-readout__place">This Week&rsquo;s schedule: </span>
            {weeklyReason === null && <>Shown in the weeks it meets.</>}
            {weeklyReason === "archived" && (
              <><span className="pe-readout__state">Not shown.</span> Archived programs don&rsquo;t appear.</>
            )}
            {weeklyReason === "hiddenListing" && (
              <><span className="pe-readout__state">Not shown.</span> Hiding it from the Programs &amp; Events page hides it here too.</>
            )}
            {weeklyReason === "hiddenWeekly" && (
              <><span className="pe-readout__state">Not shown.</span> The second box below is checked.</>
            )}
            {weeklyReason === "noSchedule" && (
              <><span className="pe-readout__state">Not shown.</span> It needs a start date and time under When and where.</>
            )}
          </p>
          <p className={`pe-readout__row${["archived", "hidden", "hiddenUntil", "noSchedule"].includes(homeState) ? " pe-readout__row--off" : ""}`}>
            <span className="pe-readout__place">Member home: </span>
            {homeState === "archived" && (
              <><span className="pe-readout__state">Not shown.</span> Archived programs don&rsquo;t appear.</>
            )}
            {homeState === "hidden" && (
              <><span className="pe-readout__state">Not shown.</span> &ldquo;Hide from member home&rdquo; is checked below, so no one sees it in Today. Registrants still see its upcoming dates.</>
            )}
            {homeState === "hiddenUntil" && (
              <><span className="pe-readout__state">Not shown yet.</span> It appears on the auto-show date set below.</>
            )}
            {homeState === "noSchedule" && (
              <><span className="pe-readout__state">Not shown.</span> It needs a start date and time under When and where.</>
            )}
            {homeState === "inPerson" && (
              <>
                Shown to people registered for it, on the days it meets.
                {removeFromProgramList && <> The &ldquo;Hide from member home&rdquo; box only affects online sessions, so it doesn&rsquo;t change this.</>}
              </>
            )}
            {homeState === "open" && (
              <>Shown to every member on the days it meets, with a Join button.</>
            )}
            {homeState === "registrants" && (
              <>Shown with a Join button to people registered for it (not the waitlist), and to its hosts and teachers.</>
            )}
          </p>
        </div>

        <label className="pe-field">
          <span className="pe-field__label">Sort Order</span>
          <span className="pe-field__help">Controls the display order on the public Programs page. Lower numbers appear first.</span>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="pe-input pe-input--narrow"
          />
        </label>

        <hr className="pe-section-divider" />

        <div className="pe-visibility-option">
          <label className="pe-checkbox">
            <input
              type="checkbox"
              checked={hideFromProgramPageList}
              onChange={(e) => setHideFromProgramPageList(e.target.checked)}
            />
            <span className="pe-checkbox__label">Hide from public Programs &amp; Events page</span>
          </label>
          <p className="pe-field__help">This program won&rsquo;t appear on the public listing or on This Week&rsquo;s schedule. Still accessible by direct URL.</p>
        </div>

        <div className="pe-visibility-option">
          <label className="pe-checkbox">
            <input
              type="checkbox"
              checked={hideFromWeeklySchedule}
              onChange={(e) => setHideFromWeeklySchedule(e.target.checked)}
            />
            <span className="pe-checkbox__label">Hide from This Week&rsquo;s Schedule</span>
          </label>
          <p className="pe-field__help">This program won&rsquo;t appear on the weekly schedule page. Useful for special events or programs that shouldn&rsquo;t clutter the regular calendar.</p>
        </div>

        {/* One-time programs only: a recurring schedule never "passes." */}
        {!recurrenceFreq && (
          <div className="pe-visibility-option">
            <label className="pe-checkbox">
              <input
                type="checkbox"
                checked={hideWhenPast}
                onChange={(e) => setHideWhenPast(e.target.checked)}
              />
              <span className="pe-checkbox__label">Hide automatically after the date passes</span>
            </label>
            <p className="pe-field__help">Once this one-time program&rsquo;s date is behind us, it leaves the public Programs &amp; Events page on its own and is archived for you the next morning. Turn off to keep it listed and active after the date.</p>
          </div>
        )}

        <div className="pe-visibility-option">
          <label className="pe-checkbox">
            <input
              type="checkbox"
              checked={removeFromProgramList}
              onChange={(e) => {
                setRemoveFromProgramList(e.target.checked);
                if (!e.target.checked) setDashboardShowAt("");
              }}
            />
            <span className="pe-checkbox__label">Hide from member home</span>
          </label>
          <p className="pe-field__help">This program won&rsquo;t appear on the member home. Still accessible by direct link and on the public site.</p>

          {removeFromProgramList && (
            <div className="pe-visibility-schedule">
              <span className="pe-field__label">Auto-show on member home</span>
              <p className="pe-field__help">Optional. On this date the program will automatically reappear on the member home — no manual action needed.</p>
              <DateTimePicker label="Auto-show on member home" value={dashboardShowAt} onChange={setDashboardShowAt} />
              {dashboardShowAt && (
                <button
                  type="button"
                  className="pe-visibility-schedule__clear"
                  onClick={() => { setDashboardShowAt(""); markDirty(); }}
                >
                  Clear scheduled date
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </EditorSection>
  );
}

export default memo(AppearsSection);
