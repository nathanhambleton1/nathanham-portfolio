// Placeholder for workflows whose tables exist but whose UI is a later phase.
// Ported from templates/coming_soon.html.

import { Link, useParams } from "react-router-dom";
import PageFrame from "../components/PageFrame";

const NAMES: Record<string, string> = {
  investments: "Investments",
};

export default function ComingSoon() {
  const { feature = "" } = useParams();
  const title = NAMES[feature] ?? "Future feature";

  return (
    <PageFrame title={title}>
      {() => (
        <article className="card coming-panel">
          <div>
            <div className="coming-mark">↗</div>
            <p className="eyebrow">Coming in a later phase</p>
            <h1>{title}</h1>
            <p>
              The database foundation is present, but this workflow is reserved for a later phase.
            </p>
            <Link className="button secondary" to="/finance">
              Return to money flow
            </Link>
          </div>
        </article>
      )}
    </PageFrame>
  );
}
