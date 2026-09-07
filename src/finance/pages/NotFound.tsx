// An unknown /finance/* path. The portfolio's own 404 covers everything outside
// this sub-app; this one keeps the person inside the finance shell so the nav
// is still there to get them back.

import { Link, useLocation } from "react-router-dom";
import PageFrame from "../components/PageFrame";

export default function NotFound() {
  const location = useLocation();

  return (
    <PageFrame title="Not found">
      {() => (
        <article className="card coming-panel">
          <div>
            <div className="coming-mark">?</div>
            <p className="eyebrow">No such page</p>
            <h1>That page isn&rsquo;t here</h1>
            <p>
              Nothing is served at <code>{location.pathname}</code>.
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
