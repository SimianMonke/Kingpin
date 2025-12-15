import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-20">
        <div className="text-center max-w-4xl mx-auto">
          {/* Logo/Title */}
          <h1 className="text-6xl md:text-8xl font-bold mb-6 tracking-tight">
            <span className="text-gradient">KINGPIN</span>
          </h1>

          {/* Tagline */}
          <p className="text-xl md:text-2xl text-gray-400 mb-8 max-w-2xl mx-auto">
            A persistent RPG economy game embedded in your streaming chat.
            Compete, rob, collect, and become the ultimate Kingpin.
          </p>

          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 mb-12">
            <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></span>
            <span className="text-sm font-medium">Coming Soon</span>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <FeatureCard
              icon="🎮"
              title="Cross-Platform"
              description="Play on Kick, Twitch, and Discord with linked accounts"
            />
            <FeatureCard
              icon="💰"
              title="Economy RPG"
              description="Build wealth, buy items, complete missions, and climb the ranks"
            />
            <FeatureCard
              icon="⚔️"
              title="Faction Warfare"
              description="Join factions, capture territories, and earn exclusive rewards"
            />
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login"
              className="px-8 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors"
            >
              Get Started
            </Link>
            <Link
              href="/leaderboards"
              className="px-8 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg font-semibold transition-colors"
            >
              View Leaderboards
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-t border-gray-800 py-12 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <StatCard value="0" label="Players" />
          <StatCard value="$0" label="Total Wealth" />
          <StatCard value="0" label="Crates Opened" />
          <StatCard value="0" label="Robberies" />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-6 px-4 text-center text-gray-500 text-sm">
        <p>
          Kingpin by{" "}
          <a
            href="https://kick.com/simianmonke"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 transition-colors"
          >
            SimianMonke
          </a>
        </p>
      </footer>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-xl bg-gray-900/50 border border-gray-800 hover:border-gray-700 transition-colors">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-3xl md:text-4xl font-bold text-gradient">{value}</div>
      <div className="text-gray-500 text-sm mt-1">{label}</div>
    </div>
  );
}
