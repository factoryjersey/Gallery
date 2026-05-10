import LegalPage from "@/components/LegalPage";

export default function Cookies() {
  return (
    <LegalPage
      eyebrow="The Legal Bit"
      title="Cookie Policy"
      intro="A short page about the small text files. We use very few. We're not selling them to advertisers. We don't track you around the internet. You can stop reading here unless you want the specifics."
    >
      <h2>What's a cookie, again?</h2>
      <p>
        A cookie is a tiny text file a website asks your browser to remember, so the next
        time you come back it can recall something useful — like which page you were on,
        or that you're logged in. Some are essential to the site working at all; others
        are for measuring how many people came to read about cricket this month.
      </p>

      <h2>What we use, and what for</h2>
      <p>The complete list, as of this writing:</p>
      <ul>
        <li>
          <strong>Session cookie</strong> — set only if you log into the admin area.
          Drops the moment you close the browser or sign out. Without it, the admin
          doesn't know it's you.
        </li>
        <li>
          <strong>Cloudflare anti-bot cookie</strong> — set by our hosting / CDN to tell
          us the difference between you and a robot trying to scrape the site. Sticks
          around for a few weeks. We can't switch it off without losing the bot
          protection.
        </li>
      </ul>
      <p>
        That's it. No advertising cookies. No third-party trackers. No cross-site
        profiling. No "we use 47 partners" banner because there aren't 47 partners.
      </p>

      <h2>Analytics</h2>
      <p>
        We count page views — anonymously, server-side, so no cookie required. We can see
        that a thousand people read a particular article; we can't see who they are, where
        they went next, or what they bought afterwards.
      </p>

      <h2>What about Do Not Track?</h2>
      <p>
        If your browser sends a "Do Not Track" signal we respect it. We're not tracking
        you in the first place, but it's a good default.
      </p>

      <h2>How to clear or block cookies</h2>
      <p>
        Every browser handles this differently — the relevant menu is usually called
        something like Privacy, Security, or Site Data. The official rundown of how to
        clear cookies in your browser is at{" "}
        <a href="https://www.aboutcookies.org" target="_blank" rel="noopener noreferrer">
          aboutcookies.org
        </a>
        . If you block all cookies, the public site will still work fine; the admin
        won't, but you're probably not in the admin.
      </p>

      <h2>If we ever change our minds</h2>
      <p>
        If we ever add anything that meaningfully tracks you — analytics that link you to
        an identity, advertising cookies, behavioural pixels — we'll put a proper banner
        up first and you'll get to opt in. We don't currently plan to. The "last updated"
        date below tells you when this was last revised.
      </p>
    </LegalPage>
  );
}
