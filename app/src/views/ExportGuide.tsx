import { useState } from 'react'
import script from '../export/trackman-export.js?raw'

const PORTAL_URL = 'https://portal.trackmangolf.com/activities'

export function ExportGuide({ onUpload }: { onUpload: () => void }) {
  const [copied, setCopied] = useState(false)
  const [showScript, setShowScript] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(script)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main className="guide">
      <section className="card">
        <header className="card-head">
          <h2>Export your data from Trackman</h2>
          <p className="muted">
            Trackman has no CSV export, so a small script run in the browser console on the Trackman portal fetches your
            sessions and downloads them as CSV. It uses the login you already have there and only talks to Trackman's own
            API. Takes about two minutes.
          </p>
        </header>

        <ol className="steps">
          <li>
            <strong>Log in to the Trackman portal</strong> and open the Activities page:{' '}
            <a href={PORTAL_URL} target="_blank" rel="noreferrer">
              portal.trackmangolf.com
            </a>
            .
          </li>
          <li>
            <strong>Open the developer console.</strong>
            <ul>
              <li>
                Chrome / Edge: <kbd>⌘</kbd> <kbd>⌥</kbd> <kbd>J</kbd> (Windows: <kbd>Ctrl</kbd> <kbd>Shift</kbd>{' '}
                <kbd>J</kbd>)
              </li>
              <li>
                Safari: enable <em>Settings → Advanced → Show features for web developers</em> once, then{' '}
                <kbd>⌘</kbd> <kbd>⌥</kbd> <kbd>C</kbd>
              </li>
            </ul>
          </li>
          <li>
            <strong>Copy the script</strong> and paste it into the console, then press <kbd>Enter</kbd>.
            <div className="guide-actions">
              <button className="primary" onClick={copy}>
                {copied ? 'Copied ✓' : 'Copy script'}
              </button>
              <button className="ghost" onClick={() => setShowScript((s) => !s)}>
                {showScript ? 'Hide script' : 'Show script'}
              </button>
            </div>
            {showScript && <pre className="code">{script}</pre>}
            <p className="muted">
              Chrome blocks pasting the first time: type <code>allow pasting</code>, press <kbd>Enter</kbd>, then paste
              again.
            </p>
          </li>
          <li>
            <strong>If the console asks for help finding the login</strong>, click one of the <em>filters at the top</em>{' '}
            of the Activities page (e.g. "All"). Don't click the menu on the left, as that reloads the page and stops the
            script. If it still fails, it asks you to paste the <code>Authorization</code> header from a{' '}
            <code>graphql</code> request (DevTools → Network → click the request → Headers).
          </li>
          <li>
            <strong>Pick sessions in the panel</strong> that opens at the top right. Click <em>Velg alle synlige</em> to
            select everything (or filter by type first).
          </li>
          <li>
            <strong>
              Click <em>Slag (CSV)</em>
            </strong>
            . This downloads <code>trackman-slag-&lt;date&gt;.csv</code>, the file this app reads. The other buttons
            (sessions, hole by hole, raw JSON) aren't used here.
          </li>
          <li>
            <strong>Upload the file here.</strong> Shots you already have are skipped, so it's fine to export everything
            every time.
            <div className="guide-actions">
              <button className="primary" onClick={onUpload}>
                Upload CSV
              </button>
            </div>
          </li>
        </ol>
      </section>

      <section className="card">
        <header className="card-head">
          <h2>Good to know</h2>
        </header>
        <ul className="notes">
          <li>
            Keep the script's default settings (<code>CSV_SEPARATOR = ','</code>, <code>DECIMAL_COMMA = false</code>).
            The semicolon / decimal-comma options are for opening the file in Norwegian Excel and won't import here.
          </li>
          <li>
            "Innloggingen er utløpt" means your portal login timed out: reload the portal and run the script again.
          </li>
          <li>
            The script uses Trackman's unofficial API, which can change without notice. Fields that disappear are skipped
            automatically and logged in the console.
          </li>
          <li>The panel's labels are in Norwegian: Slag = shots, Økter = sessions, Lukk = close.</li>
        </ul>
      </section>
    </main>
  )
}
