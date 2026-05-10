import LegalPage from "@/components/LegalPage";

export default function Privacy() {
  return (
    <LegalPage
      eyebrow="The Legal Bit"
      title="Privacy Policy"
      intro="Short version: we don't sell your data, we don't trade it for magic beans, and we only collect what we actually need. The longer version is below, because lawyers."
    >
      <h2>Who we are</h2>
      <p>
        Gallery is published by <strong>Sixbynine Limited</strong> (trading as Factory),
        registered in Jersey, company number 89716. Our office is at 10 Minden Street,
        St Helier, JE2 4WR. For anything privacy-related, write to{" "}
        <a href="mailto:hello@gallery.je">hello@gallery.je</a>.
      </p>

      <h2>What we collect, and why</h2>
      <p>The honest list:</p>
      <ul>
        <li>
          <strong>Newsletter signups.</strong> If you give us your email address through one
          of the "Subscribe" boxes, we keep it so we can send you the occasional dispatch.
          That's the only reason. You can unsubscribe with a single click in any email we
          send.
        </li>
        <li>
          <strong>Submission and contact emails.</strong> If you email us pitches, letters,
          press releases or complaints, we keep the email because that's how email works.
        </li>
        <li>
          <strong>Anonymised page view counts.</strong> We count how many people read each
          article so we know which ones to write more of. We don't tie this to you
          personally.
        </li>
      </ul>
      <p>
        Things we don't collect: your shoe size, your political opinions, behavioural
        profiles, advertising IDs, location data, or anything you didn't explicitly hand
        over.
      </p>

      <h2>Lawful basis (since you asked)</h2>
      <ul>
        <li>
          <strong>Consent</strong> when you tick a newsletter box or send us an email.
        </li>
        <li>
          <strong>Legitimate interests</strong> for running and improving the website —
          counting how many people visit, fixing bugs, that sort of thing.
        </li>
      </ul>

      <h2>Who sees your data</h2>
      <p>
        The short answer: us, and the boring infrastructure companies that run the
        actual plumbing. Specifically:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> hosts the database where your email lives (EU region,
          encrypted at rest).
        </li>
        <li>
          <strong>Cloudflare</strong> serves the website and our images, and protects us
          from bots and worse.
        </li>
        <li>
          <strong>Resend</strong> delivers our newsletter emails when (and only when) we
          send one.
        </li>
        <li>
          <strong>Railway</strong> runs the application code.
        </li>
      </ul>
      <p>
        None of these companies are allowed to do anything with your data beyond what we
        need them to do. We never sell, rent, swap, donate, or trade your information.
      </p>

      <h2>How long we keep things</h2>
      <p>
        Newsletter emails: while you're subscribed, plus 30 days after you unsubscribe in
        case you change your mind. Anonymised analytics: indefinitely. Submission emails:
        as long as makes sense for the conversation, then we tidy them up.
      </p>

      <h2>Your rights</h2>
      <p>
        Under the Data Protection (Jersey) Law 2018 — and the UK GDPR if you're reading
        from across the water — you can ask us to:
      </p>
      <ul>
        <li>Tell you what we hold about you.</li>
        <li>Correct anything that's wrong.</li>
        <li>Delete it entirely.</li>
        <li>Send it to you in a portable form.</li>
        <li>Stop using it for a particular purpose.</li>
      </ul>
      <p>
        Email <a href="mailto:hello@gallery.je">hello@gallery.je</a> and we'll get back
        to you within a few working days. If we let you down, you can complain to the
        Office of the Information Commissioner Jersey at{" "}
        <a href="https://jerseyoic.org" target="_blank" rel="noopener noreferrer">
          jerseyoic.org
        </a>
        .
      </p>

      <h2>Changes</h2>
      <p>
        If we update this policy in a way that materially affects you, we'll mention it in
        the next newsletter. The "last updated" date below tells you when it was last
        touched.
      </p>
    </LegalPage>
  );
}
