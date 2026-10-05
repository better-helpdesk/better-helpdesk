import { Bar, Foot } from '../chrome';

export default function Privacy() {
  return (
    <>
      <Bar here="site" />
      <main id="main" className="shell band">
        <div className="notice">
          <h1>Privacy</h1>
          <p>
            Harbor is make-believe. What you send through the widget is stored
            in the Postgres this demo runs against, and nowhere else.
          </p>
          <a className="btn" href="/">
            Back to the overview
            <span className="btn-icon" aria-hidden="true">
              →
            </span>
          </a>
        </div>
      </main>
      <Foot />
    </>
  );
}
