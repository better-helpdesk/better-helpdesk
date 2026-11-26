import { Bar, Foot } from './chrome';

export default function NotFound() {
  return (
    <>
      <Bar here="site" />
      <main id="main" className="shell band">
        <div className="notice">
          <h1>No such page</h1>
          <p>
            Harbor only has the overview, the agent inbox and a privacy note.
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
