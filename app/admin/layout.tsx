import Link from "next/link";
import styles from "./layout.module.css";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <span className={styles.brand}>Agents, Not Ads. — Admin</span>
          <div className={styles.navLinks}>
            <Link href="/admin/queue" className={styles.navLink}>
              Queue
            </Link>
            <Link href="/admin/approved" className={styles.navLink}>
              Approved
            </Link>
            <Link href="/admin/newsletter" className={styles.navLink}>
              Newsletter
            </Link>
            <Link href="/admin/sources" className={styles.navLink}>
              Sources
            </Link>
          </div>
          <form
            action="/api/admin/logout"
            method="POST"
            className={styles.logoutForm}
          >
            <button type="submit" className={styles.logoutBtn}>
              Logout
            </button>
          </form>
        </div>
      </nav>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
