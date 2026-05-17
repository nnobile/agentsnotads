import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import styles from "../../subscribe/subscribe.module.css";

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  params,
}: {
  params: { token: string };
}) {
  const supabase = createServiceClient();

  const { data: subscriber } = await supabase
    .from("subscribers")
    .select("id, unsubscribed_at")
    .eq("confirmation_token", params.token)
    .maybeSingle();

  if (!subscriber) notFound();

  if (!subscriber.unsubscribed_at) {
    await supabase
      .from("subscribers")
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq("id", subscriber.id);
  }

  return (
    <div className={styles.simpleShell}>
      <div className={styles.simpleBox}>
        <h1 className={styles.simpleHeadline}>
          You&rsquo;ve been unsubscribed.
        </h1>
        <p className={styles.simpleSubtext}>
          You won&rsquo;t receive any more emails from Agents, Not Ads.
        </p>
        <Link href="/" className={styles.homeLink}>
          ← Back to homepage
        </Link>
      </div>
    </div>
  );
}
