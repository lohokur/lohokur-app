import Link from 'next/link';

export default function ProfilePage() {
  return (
    <main className="home">
      <h1 className="home-title">My profile</h1>
      <p className="home-sub">Profile settings are coming soon.</p>
      <Link href="/" className="new-btn" style={{ display: 'inline-block' }}>← Back to projects</Link>
    </main>
  );
}
