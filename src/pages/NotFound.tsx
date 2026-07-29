const NotFound = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md rounded-md border border-minimal-border bg-card p-10 text-center shadow-minimal">
        <h1 className="mb-4 text-5xl font-semibold">404</h1>
        <p className="mb-6 text-base leading-7 text-foreground/68">
          This page is not part of the public portfolio.
        </p>
        <a
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-foreground px-5 py-3 text-sm font-semibold text-background hover:bg-foreground/88"
        >
          Return Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
