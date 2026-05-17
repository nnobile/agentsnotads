import styles from "./login.module.css";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const hasError = !!searchParams.error;
  const isConfigError = searchParams.error === "config";

  return (
    <div className={styles.shell}>
      <div className={styles.box}>
        <span className={styles.brand}>Agents, Not Ads.</span>
        <p className={styles.sub}>Admin dashboard</p>

        {hasError && (
          <div className={styles.error}>
            {isConfigError
              ? "ADMIN_PASSWORD_HASH is not set in .env.local."
              : "Incorrect password. Try again."}
          </div>
        )}

        <form action="/api/admin/login" method="POST">
          <label className={styles.label} htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            name="password"
            className={styles.input}
            autoFocus
            autoComplete="current-password"
          />
          <button type="submit" className={styles.btn}>
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
