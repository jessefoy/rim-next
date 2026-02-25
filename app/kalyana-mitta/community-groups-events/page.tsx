import Link from "next/link";

export const metadata = { title: "Community Groups and Activities — Rooted In Mindfulness" };

export default function KalyanaGroupsPage() {
  return (
    <>
      <div className="section-20">
        <div className="main-container">
          <div className="w-layout-grid grid-halves-4">
            <div className="container">
              <div className="image-wrapper">
                <div className="fade-image-on-scroll">
                  <img
                    src="/images/Community-Hands-on-Tree.jpg"
                    alt="Diversity Community Hands on Tree Together"
                    srcSet="/images/Community-Hands-on-Tree-p-500.jpeg 500w, /images/Community-Hands-on-Tree-p-800.jpeg 800w, /images/Community-Hands-on-Tree.jpg 900w"
                    sizes="(max-width: 479px) 100vw, (max-width: 767px) 88vw, (max-width: 991px) 469px, 44vw"
                    className="fade-image-element"
                  />
                </div>
              </div>
            </div>
            <div
              id="w-node-_40ab4b02-a826-8442-5396-747c555ec687-dcb725b4"
              className="container increased-width align-bottom"
            >
              <h1>
                Community Groups and Activities
                <br />
              </h1>
              <div className="large-text">
                Connect with others to deepen your learning, practice, shared interests, affinity
                connections, engaged mindfulness, and grow{" "}
                <strong>
                  <em>spiritual friendships</em>
                </strong>
                . Following tradition, these community lead activities are called{" "}
                <strong>
                  <em>Kalyana</em>
                </strong>{" "}
                <strong>
                  <em>Mitta</em>
                </strong>
                .
              </div>
              <div className="button-row">
                <a href="#About-KM-Groups" className="button-5 w-inline-block">
                  <div className="button-text">Learn More ↓</div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="About-KM-Groups" className="section-19 bg-accent-2">
        <div className="main-container">
          <div className="container increased-width align-center">
            <div className="article w-richtext">
              <h2>
                About Kalyana <strong></strong>Mitta Groups and Activities
              </h2>
              <p>
                <strong>Kalyana Mitta (KM)</strong> is a Pali term that loosely means
                &quot;supportive friend.&quot; It refers to fellow travelers on the Dharma path who
                come together to support each other&apos;s learning, meditation, and mindful living
                practice.
                <br />
              </p>
              <p>
                KM groups and events connect us. They provide opportunities to study the Dharma,
                share mindfulness and meditation experiences, and build meaningful friendships
                rooted in shared interests and common intentions.
              </p>
            </div>
            <div className="button-row">
              <a href="#Current-KM-Groups" className="button-5 w-inline-block">
                <div className="button-text">Find A KM Group / Event</div>
                <div className="button-hover-element"></div>
              </a>
              <Link
                href="/kalyana-mitta/kalyana-mitta-group-application"
                className="button-5 bordered adjacent-to-button w-inline-block"
              >
                <div className="text-block-66">Start A Group / Event</div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div id="Current-KM-Groups" className="section-19">
        <div className="main-container">
          <div className="container increased-width align-center">
            <div className="section-title-3">
              <h2>Looking for a Community Group or Event?</h2>
              <div className="w-richtext">
                <p>
                  Are you interested in joining a Community Group or Event at Rooted In
                  Mindfulness? Explore current groups:
                </p>
              </div>
            </div>
            <div>
              <div className="div-block-136">
                <div className="w-richtext">
                  <p>
                    Don&apos;t see a group or event that fits your needs? Consider starting a new
                    one.
                  </p>
                </div>
                <div className="button-row remove-spacing">
                  <Link
                    href="/kalyana-mitta/kalyana-mitta-group-application"
                    className="button-5 w-inline-block"
                  >
                    <div className="text-block-79">Start A Group / Event</div>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
