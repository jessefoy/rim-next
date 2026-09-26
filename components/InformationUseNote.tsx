export default function InformationUseNote({ registration = false }: { registration?: boolean }) {
  return (
    <p className="pp-form__help rim-information-use">
      Your name and email identify your account and let us send sign-in and program messages.
      Phone is optional and is saved with your contact information if provided.{registration && " Answers to program questions are saved with your registration to help organize the gathering."}{" "}
      Newsletter signup is separate. For questions about your information, contact{" "}
      <a href="mailto:support@rootedinmindfulness.org?subject=My%20information">support@rootedinmindfulness.org</a>.
    </p>
  );
}
