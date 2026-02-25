import { sanityClient } from "@/lib/sanity";
import { programBySlugQuery, allProgramSlugsQuery } from "@/lib/queries";
import { PortableText } from "@portabletext/react";
import { auth } from "@/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import TeacherList from "@/components/TeacherList";
import MemberGate from "@/components/MemberGate";

export const revalidate = 60;

interface Teacher {
  name: string;
  slug: { current: string };
  title?: string;
  bioPicture?: { asset: { url: string } };
}

interface Program {
  _id: string;
  name: string;
  slug: { current: string };
  tagline?: string;
  dateText?: string;
  timeText?: string;
  locationText?: string;
  locationLink?: string;
  danaText?: string;
  registrationRequired?: boolean;
  registrationClosed?: boolean;
  filloutRegistrationFormId?: string;
  zoomLink?: string;
  zoomLinkText?: string;
  quote?: string;
  quoteSource?: string;
  programDescription?: any[];
  specialNotes?: any[];
  signedOutInstructions?: any[];
  signedInInstructions?: any[];
  programCategory?: { name: string; slug: { current: string } };
  teacherFacilitators?: Teacher[];
  dayOfWeek?: { name: string; slug: { current: string } }[];
}

export async function generateStaticParams() {
  const slugs = await sanityClient.fetch<{ slug: string }[]>(allProgramSlugsQuery);
  return slugs.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const program = await sanityClient.fetch<Program | null>(programBySlugQuery, { slug });
  return {
    title: program ? `${program.name} — Rooted In Mindfulness` : "Program Not Found",
  };
}

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [program, session] = await Promise.all([
    sanityClient.fetch<Program | null>(programBySlugQuery, { slug }),
    auth(),
  ]);

  if (!program) notFound();

  const isLoggedIn = !!session;

  return (
    <>
      <div id="Community-Programs-Header-Link" className="program-header-section community-programs-page">
        <div className="program-title-block">
          <Link href="/community-programs" className="breadcrumb-link w-inline-block">
            <div className="text-block-58">
              {program.programCategory?.name ?? "Programs"}
            </div>
          </Link>
          <h1 className="heading-9">{program.name}</h1>
          {program.tagline && <h2 className="heading-39">{program.tagline}</h2>}
        </div>
      </div>

      <div className="program-details-section">
        <div className="content-container centered">
          {program.quote && (
            <div className="program-quote-block">
              <p className="program-quote-text">{program.quote}</p>
              {program.quoteSource && (
                <div className="quote-source">
                  <div className="program-quote-source-dash">-</div>
                  <div className="program-quote-source-text">{program.quoteSource}</div>
                </div>
              )}
            </div>
          )}

          <div className="program-description-and-details-block">
            {program.programDescription && (
              <div className="rich-text-block-19 w-richtext">
                <PortableText value={program.programDescription} />
              </div>
            )}

            {program.specialNotes && (
              <div className="additional-program-noted w-richtext">
                <PortableText value={program.specialNotes} />
              </div>
            )}

            <div className="registration-details-section">
              <div className="program-details-content no-bottom-margin">
                <h3 className="details-header">Details:</h3>
                <div>
                  {program.dateText && (
                    <>
                      <div className="_10px-spacer"></div>
                      <div>
                        <img src="/images/Date.png" width={20} height={20} alt="" />
                        <div className="program-detail-item">{program.dateText}</div>
                      </div>
                    </>
                  )}
                  {program.timeText && (
                    <>
                      <div className="_10px-spacer"></div>
                      <div>
                        <img src="/images/Time.png" width={25} height={25} alt="" />
                        <div className="program-detail-item">{program.timeText}</div>
                      </div>
                    </>
                  )}
                  {program.locationText && (
                    <>
                      <div className="_10px-spacer"></div>
                      <div className="date-time-register-dana-block">
                        <img src="/images/Location.png" width={30} height={30} alt="" />
                        <div className="program-detail-item">{program.locationText}</div>
                        {program.locationLink && (
                          <a
                            href={program.locationLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-inline-block"
                          >
                            <div className="more-details-trigger-text-dana">--&gt;</div>
                          </a>
                        )}
                      </div>
                    </>
                  )}
                  {program.danaText && (
                    <>
                      <div className="_10px-spacer"></div>
                      <div className="date-time-register-dana-block">
                        <img src="/images/Dana.png" width={35} height={35} alt="" />
                        <div className="program-detail-item">{program.danaText}</div>
                      </div>
                    </>
                  )}
                  {program.registrationRequired && (
                    <>
                      <div className="_10px-spacer"></div>
                      <div className="date-time-register-dana-block">
                        <img src="/images/Registration_Icon.png" width={20} height={20} alt="" />
                        <a href="#registration-section" className="w-inline-block">
                          <div className="program-detail-item link">
                            <strong>Please Register to Attend ↓</strong>
                          </div>
                        </a>
                      </div>
                    </>
                  )}
                  {program.teacherFacilitators && program.teacherFacilitators.length > 0 && (
                    <>
                      <div className="_10px-spacer"></div>
                      <h3 className="details-header top-margin-20-px">Facilitators:</h3>
                      <TeacherList
                        teachers={program.teacherFacilitators}
                        variant="program"
                      />
                    </>
                  )}
                </div>
              </div>
            </div>

            <div id="registration-section" className="program-registration-section">
              {!isLoggedIn && (
                <MemberGate signedOutInstructions={program.signedOutInstructions} />
              )}

              {isLoggedIn && program.registrationRequired && !program.registrationClosed && (
                <div className="logged-in---registration-required">
                  <h3 className="details-header">Register</h3>
                  {program.signedInInstructions && (
                    <div className="signed-in-instructions w-richtext">
                      <PortableText value={program.signedInInstructions} />
                    </div>
                  )}
                  {program.filloutRegistrationFormId && (
                    <div className="fillout-registration-embed w-embed w-script">
                      <div
                        style={{ width: "100%", height: "500px" }}
                        data-fillout-id={program.filloutRegistrationFormId}
                        data-fillout-embed-type="standard"
                        data-fillout-inherit-parameters=""
                        data-fillout-dynamic-resize=""
                      ></div>
                      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
                      <script src="https://server.fillout.com/embed/v1/"></script>
                    </div>
                  )}
                </div>
              )}

              {isLoggedIn && !program.registrationRequired && (
                <div className="logged-in---registration-not-required-message">
                  <h3 className="details-header">No Registration Required</h3>
                  {program.signedInInstructions && (
                    <div className="signed-in-instructions w-richtext">
                      <PortableText value={program.signedInInstructions} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
