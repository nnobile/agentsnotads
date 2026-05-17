import Link from "next/link";
import styles from "../subscribe.module.css";

export default function ConfirmedPage() {
  return (
    <div className={styles.simpleShell}>
      <div className={styles.simpleBox}>
        <h1 className={styles.simpleHeadline}>You&rsquo;re on the list.</h1>
        <p className={styles.simpleSubtext}>
          Check back soon for your first digest.
        </p>
        <Link href="/" className={styles.homeLink}>
          ← Back to homepage
        </Link>
      </div>
    </div>
  );
}
