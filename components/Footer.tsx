const REPO_URL = "https://github.com/nethunirajapakse/solana-dashboard";

export default function Footer() {
  return (
    <footer className="site-footer">
      <p>
        Market data from{" "}
        <a href="https://www.solanatracker.io" target="_blank" rel="noopener noreferrer">
          SolanaTracker
        </a>
        . Prices are informational and may be delayed by up to a few minutes.
        This is not financial advice.
      </p>
      <p>
        <a href={`${REPO_URL}/issues/new`} target="_blank" rel="noopener noreferrer">
          Report a bug or suggest a feature
        </a>
        {" · "}
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          Source
        </a>
      </p>
    </footer>
  );
}
