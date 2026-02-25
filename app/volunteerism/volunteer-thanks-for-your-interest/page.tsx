import { auth } from "@/auth";

export const metadata = { title: "Thanks for Your Interest in Volunteering — Rooted In Mindfulness" };

export default async function VolunteerThanksPage() {
  const session = await auth();
  const firstName = session?.user?.name ?? "";

  return (
    <div className="section background-white">
      <div className="content-container">
        <div className="diversity-content-box">
          <div className="w-richtext">
            <h2>Thanks{firstName ? `, ${firstName}` : ""}!</h2>
            <p>
              Your volunteerism helps co-creating a truly supportive refuge community at Rooted In
              Mindfulness. On behalf of the lives you impact with your care and generosity,{" "}
              <strong>thank you.</strong>
            </p>
            <p>Someone from RIM will get in touch with you soon.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
